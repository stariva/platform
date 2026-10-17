import { error, oc, type } from "@orpc/contract";
import { z } from "zod";

/**
 * Гостевой заказ: покупатель открывает ссылку без входа и подтверждает себя
 * телефоном из заказа — чтобы нельзя было подобрать чужой заказ по id.
 * Тексты своих ошибок видит покупатель.
 */

/** Нет такого заказа или телефон не совпал — клиенту не говорим, что именно. */
export const OrderNotFoundError = error("ORDER_NOT_FOUND", {
  message: "Заказ не найден",
});

/** Мастер уже согласовал заявку: мерки и пожелания больше не принимаем. */
export const OrderDetailsLockedError = error("ORDER_DETAILS_LOCKED", {
  message: "Мастер уже согласовал заказ — изменения обсудите с ним в Telegram.",
});

/** Нет ключей эквайринга. */
export const PaymentsUnavailableError = error("PAYMENTS_UNAVAILABLE", {
  message: "Приём платежей временно недоступен",
});

/** Заказ не ждёт оплату (уже оплачен, не одобрен или отклонён). */
export const NothingToPayError = error("NOTHING_TO_PAY", {
  message: "Сейчас по заказу нечего оплачивать. Обновите страницу.",
});

/** Оплату ждали, но срок вышел: платить можно после продления мастером. */
export const PaymentOverdueError = error("PAYMENT_OVERDUE", {
  message: "Срок оплаты истёк. Напишите мастеру — он продлит его.",
});

/** Эквайринг не дал ссылку на оплату. */
export const PaymentCreateFailedError = error("PAYMENT_CREATE_FAILED", {
  message: "Не удалось создать платёж. Попробуйте позже.",
});

/** Одна мерка в см: подпись сохраняем как в момент заказа. */
export const measurementEntrySchema = z.object({
  label: z.string().trim().min(1).max(60),
  value: z
    .string()
    .trim()
    .regex(/^\d{1,4}(?:[.,]\d{1,2})?$/, "Введите положительное число")
    .refine((value) => Number(value.replace(",", ".")) > 0, {
      message: "Введите положительное число",
    }),
});

const orderId = z.string().min(1).max(200);
const phone = z.string().min(5, "Укажите телефон").max(32);

/** Мерки, о которых мастер спрашивает по изделию. */
export const measurementFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  hint: z.string(),
});

export const orderItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().int().nonnegative(),
  options: z
    .object({
      size: z.string(),
      color: z.string(),
      measurements: z.array(z.object({ label: z.string(), value: z.string() })),
      comment: z.string().optional(),
    })
    .nullable(),
  image: z.string().nullable(),
  measurementFields: z.array(measurementFieldSchema),
});

/** Какую оплату заказ под заказ ждёт сейчас. */
export const paymentStepSchema = z.object({
  type: z.enum(["deposit", "balance"]),
  /** Копейки. */
  amount: z.number().int().positive(),
});

/** Заказ глазами покупателя; суммы в копейках, даты — ISO-строки. */
export const orderViewSchema = z.object({
  number: z.number().int().positive(),
  kind: z.enum(["stock", "made_to_order"]),
  status: z.string(),
  paid: z.boolean(),
  amountTotal: z.number().int().nonnegative(),
  amountProducts: z.number().int().nonnegative(),
  amountDelivery: z.number().int().nonnegative(),
  // Под заказ: условия, согласованные мастером, и что оплачивать сейчас
  depositAmount: z.number().int().nullable(),
  depositPaid: z.boolean(),
  leadTime: z.string().nullable(),
  paymentDueAt: z.string().nullable(),
  paymentOverdue: z.boolean(),
  paymentStep: paymentStepSchema.nullable(),
  declineReason: z.string().nullable(),
  createdAt: z.string(),
  deliveryMethod: z.string(),
  customerNotes: z.string().nullable(),
  deliveryNote: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  items: z.array(orderItemSchema),
  postings: z.array(
    z.object({ postingNumber: z.string(), status: z.string() }),
  ),
});

export type OrderView = z.infer<typeof orderViewSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type OrderPaymentStep = z.infer<typeof paymentStepSchema>;

/** Дополнение заявки под заказ: мерки и комментарий по позициям, пожелания. */
export const orderDetailsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        measurements: z.array(measurementEntrySchema).max(10),
        comment: z.string().trim().max(1500).optional(),
      }),
    )
    .max(20),
  customerNotes: z.string().trim().max(1500).optional(),
  deliveryNote: z.string().trim().max(1000).optional(),
});

export type OrderDetails = z.infer<typeof orderDetailsSchema>;

export const ordersContract = {
  /** Просмотр заказа. Оплаченный в ЮKassa, но не отмеченный заказ досинхронизируется. */
  view: oc
    .errors({ [OrderNotFoundError.code]: OrderNotFoundError })
    .input(z.object({ orderId, phone }))
    .output(orderViewSchema),

  /** Покупатель дополняет заявку под заказ, пока мастер её не одобрил. */
  updateDetails: oc
    .errors({
      [OrderNotFoundError.code]: OrderNotFoundError,
      [OrderDetailsLockedError.code]: OrderDetailsLockedError,
    })
    .input(orderDetailsSchema.extend({ orderId, phone }))
    .output(type<void>()),

  /**
   * Оплата текущего этапа заказа под заказ: предоплата после одобрения
   * мастером или доплата после изготовления. Сумму берём из заказа.
   */
  pay: oc
    .errors({
      [OrderNotFoundError.code]: OrderNotFoundError,
      [PaymentsUnavailableError.code]: PaymentsUnavailableError,
      [NothingToPayError.code]: NothingToPayError,
      [PaymentOverdueError.code]: PaymentOverdueError,
      [PaymentCreateFailedError.code]: PaymentCreateFailedError,
    })
    .input(
      z.object({
        orderId,
        phone,
        // Оферту покупатель принимает при оплате — когда итоговая цена уже согласована.
        offerAccepted: z.literal(true, {
          error: "Подтвердите согласие с офертой",
        }),
        // Из личного кабинета после оплаты возвращаем в кабинет, а не на гостевую страницу.
        returnTo: z.enum(["order", "account"]).optional(),
      }),
    )
    .output(z.object({ confirmationUrl: z.url({ protocol: /^https?$/ }) })),
};
