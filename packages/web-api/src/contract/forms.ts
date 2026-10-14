import { error, oc, type } from "@orpc/contract";
import { z } from "zod";

/**
 * Публичные формы витрины: подписка, заявка на изделие, токен антиспама.
 * Тексты ошибок — для посетителя: клиент показывает их как есть.
 */

export const NewsletterFailedError = error("NEWSLETTER_FAILED", {
  message: "Не удалось оформить подписку. Попробуйте позже.",
});

export const CustomOrderUnavailableError = error("CUSTOM_ORDER_UNAVAILABLE", {
  message:
    "Приём заявок временно недоступен. Напишите мастеру в мессенджер или позвоните.",
});

/** Повтор с тем же requestId, но другими данными. */
export const CustomOrderConflictError = error("CUSTOM_ORDER_CONFLICT", {
  message: "Заявка изменилась. Попробуйте отправить её ещё раз.",
});

export const CustomOrderSaveFailedError = error("CUSTOM_ORDER_SAVE_FAILED", {
  message:
    "Не удалось сохранить заявку. Данные остались в форме — повторите отправку или свяжитесь с мастером.",
});

export const MAX_ORDER_PHOTO_BYTES = 8 * 1024 * 1024;

/**
 * Поля заявки в том виде, в каком они хранятся в базе и попадают в отпечаток
 * для повторов: строки `"true"` оставлены как есть, их читает и админка.
 */
export const customOrderRequestSchema = z.object({
  requestId: z.uuid().optional(),
  name: z.string().trim().max(120).optional().default(""),
  contact: z.string().trim().min(3, "Укажите контакт для связи").max(200),
  description: z
    .string()
    .trim()
    .min(5, "Опишите, что хотите заказать")
    .max(3000),
  productType: z.string().max(60).optional(),
  size: z.string().max(60).optional(),
  measurements: z.string().trim().max(500).optional(),
  measurementHelp: z.enum(["true", "false"]).optional(),
  color: z.string().max(60).optional(),
  complexity: z.string().max(60).optional(),
  budget: z.string().trim().max(100).optional(),
  estimateMin: z.coerce.number().finite().nonnegative().optional(),
  estimateMax: z.coerce.number().finite().nonnegative().optional(),
  personalDataConsent: z.literal("true", {
    error: "Нужно согласие на обработку персональных данных",
  }),
});

export type CustomOrderRequest = z.infer<typeof customOrderRequestSchema>;

export const formsContract = {
  /**
   * Токен для форм входа и регистрации (антиспам better-auth). Форма берёт
   * его при открытии страницы: по возрасту токена сервер отличает человека
   * от скрипта.
   */
  formToken: oc.output(z.object({ token: z.string() })),

  /** Подписка на рассылку: уведомление мастеру в Telegram и на почту. */
  subscribeNewsletter: oc
    .errors({ [NewsletterFailedError.code]: NewsletterFailedError })
    .input(
      z.object({
        email: z.email("Укажите корректный email").max(200),
        // Откуда пришла подписка — блог, футер, поп-ап и т.д.
        source: z.string().max(60).optional(),
        // Согласие на обработку ПДн (152-ФЗ) и на рекламу (ст. 18 38-ФЗ)
        personalDataConsent: z.literal(true, {
          error: "Нужно согласие на обработку персональных данных",
        }),
        marketingConsent: z.literal(true, {
          error: "Нужно согласие на получение рассылки",
        }),
      }),
    )
    .output(type<void>()),

  /**
   * Заявка на изделие на заказ. Сначала сохраняется, уведомление уходит уже
   * после ответа. Повтор с тем же requestId возвращает тот же номер.
   */
  submitCustomOrder: oc
    .errors({
      [CustomOrderUnavailableError.code]: CustomOrderUnavailableError,
      [CustomOrderConflictError.code]: CustomOrderConflictError,
      [CustomOrderSaveFailedError.code]: CustomOrderSaveFailedError,
    })
    .input(
      customOrderRequestSchema.extend({
        photo: z
          .file()
          .max(
            MAX_ORDER_PHOTO_BYTES,
            "Фото слишком большое. Выберите файл до 8 МБ.",
          )
          .mime(
            ["image/jpeg", "image/png", "image/webp"],
            "Выберите фото в формате JPG, PNG или WebP.",
          )
          .optional(),
        // Ловушка для ботов: поле скрыто от людей и должно быть пустым
        website: z.string().max(500).optional(),
      }),
    )
    .output(z.object({ requestId: z.string(), requestNumber: z.number() })),
};
