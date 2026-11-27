import { error, oc } from "@orpc/contract";
import { z } from "zod";
import {
  DeliveryPointUnavailableError,
  PaymentCreateFailedError,
  PaymentsUnavailableError,
} from "./orders";

/**
 * Оформление заказа: расчёт и проверка доставки Ozon, заказ готовых изделий
 * с оплатой и заявка на изделия под заказ. Вызывает браузер покупателя, вход
 * не нужен: сессию, если она есть, процедуры берут сами.
 * Тексты своих ошибок видит покупатель.
 */

/** Ключей Ozon Доставки нет. */
export const DeliveryUnavailableError = error("DELIVERY_UNAVAILABLE", {
  message: "Доставка Ozon временно недоступна",
});

/** Ozon принял запрос, но доставки по выбранному адресу нет. */
export const DeliveryNotAvailableError = error("DELIVERY_NOT_AVAILABLE", {
  message: "Доставка по выбранному адресу недоступна",
});

/**
 * Стоимость доставки при создании заказа оказалась выше, чем покупатель видел
 * на странице. Витрина пересчитывает доставку и просит подтвердить сумму.
 */
export const DeliveryPriceChangedError = error("DELIVERY_PRICE_CHANGED", {
  message: "Стоимость доставки изменилась. Проверьте сумму и оплатите ещё раз.",
});

/** Цена товаров изменилась после показа корзины, в том числе из-за входа или выхода. */
export const ProductsPriceChangedError = error("PRODUCTS_PRICE_CHANGED", {
  message: "Цена товаров изменилась. Проверьте новую сумму и оплатите ещё раз.",
});

/**
 * Промокод нельзя применить к этому заказу. Точная причина — в `data.reason`,
 * её можно показать покупателю.
 */
export const PromoCodeInvalidError = error("PROMO_CODE_INVALID", {
  message: "Промокод больше не действует",
  data: z.object({ reason: z.string() }),
});

/**
 * Товары из корзины сняты с продажи или раскуплены. Витрина убирает их из
 * корзины по списку.
 */
export const ItemsUnavailableError = error("ITEMS_UNAVAILABLE", {
  message: "Некоторых товаров из корзины уже нет в наличии",
  data: z.object({ unavailableProductSlugs: z.array(z.string()).min(1) }),
});

/** В заказе есть отдельные новогодние фигурки, но их меньше минимальной партии. */
export const MinimumOrderNotMetError = error("MINIMUM_ORDER_NOT_MET", {
  message: "Минимальный заказ новогодних фигурок — 7 шт.",
  data: z.object({
    minimum: z.number().int().positive(),
    quantity: z.number().int().nonnegative(),
  }),
});

/** Выбранные размер или цвет изделия под заказ больше недоступны. */
export const OptionsUnavailableError = error("OPTIONS_UNAVAILABLE", {
  message: "Выбранный размер или цвет недоступен. Выберите заново.",
});

/**
 * Не удалось проверить товары, заявку или доставку (каталог или Ozon не
 * ответили). Процедура уточняет текст: что именно не удалось.
 */
export const CheckoutCheckFailedError = error("CHECKOUT_CHECK_FAILED", {
  message: "Не удалось проверить товары и доставку",
});

/** Изделий под заказ в одной позиции: каждое плетётся отдельно. */
export const MAX_MADE_TO_ORDER_QUANTITY = 10;
/** Позиций под заказ в одном заказе. */
export const MAX_MADE_TO_ORDER_LINES = 20;

/**
 * Телефон для Ozon Доставки: Ozon принимает 10–15 цифр, остальное
 * (+, пробелы, скобки, дефисы) отбрасывается при отправке.
 */
export const DELIVERY_PHONE_ERROR = "Укажите телефон полностью";

export function isDeliveryPhone(value: string): boolean {
  return /^\d{10,15}$/.test(value.replace(/\D/g, ""));
}

const phone = z.string().max(32).refine(isDeliveryPhone, DELIVERY_PHONE_ERROR);

const stockItemSchema = z.object({
  productId: z.string().min(1).optional(),
  productSlug: z.string().min(1),
  quantity: z.number().int().positive().max(99),
});

const pickupDeliverySchema = z.object({
  method: z.literal("pickup"),
  pointId: z.string().min(1),
  /**
   * Название и адрес пункта так, как их видел покупатель. Нужен только когда
   * Ozon не отвечает и заказ уходит с ручной доставкой: мастеру нужен адрес,
   * а взять его из Ozon нельзя. В обычном заказе адрес берётся из Ozon.
   */
  pointLabel: z.string().trim().max(400).optional(),
});

const personalDataConsent = z.literal(true, {
  error: "Нужно согласие на обработку персональных данных",
});

export const phoneCheckSchema = z.object({
  available: z.boolean(),
  /** Почему недоступно, если `available` ложно. */
  reason: z.string().optional(),
});

export type PhoneCheck = z.infer<typeof phoneCheckSchema>;

export const quoteInputSchema = z.object({
  contactPhone: phone,
  items: z.array(stockItemSchema).min(1).max(100),
  delivery: pickupDeliverySchema,
});

export type QuoteInput = z.infer<typeof quoteInputSchema>;

export const checkoutQuoteSchema = z.object({
  available: z.boolean(),
  /** Почему недоступно, если `available` ложно. */
  reason: z.string().optional(),
  /** Стоимость доставки, копейки. */
  deliveryPriceKopecks: z.number().int().nonnegative(),
  /** Даты прибытия по отправлениям (ISO): покупателю показываем самую позднюю. */
  shipments: z.array(z.object({ dateFrom: z.string(), dateTo: z.string() })),
  /**
   * Ozon не ответил, расчёта нет: доставка бесплатна для покупателя, а заказ
   * мастер отправит вручную.
   */
  manual: z.boolean().optional(),
});

export type CheckoutQuote = z.infer<typeof checkoutQuoteSchema>;

export const createOrderInputSchema = z.object({
  contactName: z.string().min(1).max(120),
  contactPhone: phone,
  contactEmail: z.email("Укажите email").trim(),
  comment: z.string().trim().max(1500).optional(),
  /**
   * Набор в подарок: доступ к мастер-классу не уходит на почту, а выдаётся
   * кодом на купоне в коробке. Без наборов в заказе флаг ничего не меняет.
   */
  gift: z.boolean().optional(),
  /** Special pricing for an order containing only two or three tree kits. */
  kitAccessMode: z.enum(["single_lesson", "separate_gifts"]).optional(),
  items: z.array(stockItemSchema).min(1).max(100),
  delivery: pickupDeliverySchema,
  /**
   * Стоимость доставки, которую покупатель видел на странице. Если сервер
   * насчитал больше, заказ не создаётся: `DELIVERY_PRICE_CHANGED`. Меньше или
   * бесплатно (Ozon не ответил) — можно. Без поля проверки нет.
   */
  expectedDeliveryKopecks: z.number().int().nonnegative().optional(),
  /** Не создаём платёж, если серверная цена товаров выше показанной покупателю. */
  expectedProductsKopecks: z.number().int().positive().optional(),
  // Отдельное согласие на обработку ПДн (ст. 9 152-ФЗ) и акцепт оферты.
  personalDataConsent,
  offerAccepted: z.literal(true, { error: "Подтвердите согласие с офертой" }),
  // robokassa — Яндекс Пэй или Сплит; без поля — карта или СБП через ЮKassa
  paymentProvider: z.enum(["yookassa", "robokassa"]).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export const createdOrderSchema = z.object({
  confirmationUrl: z.url({ protocol: /^https?$/ }),
  orderId: z.string().min(1),
  orderNumber: z.number().int().positive(),
  analytics: z.object({
    id: z.string().min(1),
    /** Рубли. */
    revenue: z.number().nonnegative(),
    products: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        /** Рубли. */
        price: z.number().nonnegative(),
        quantity: z.number().int().positive(),
      }),
    ),
  }),
});

export type CreatedOrder = z.infer<typeof createdOrderSchema>;

/** Где покупателю удобнее ответить мастеру по заявке. */
export const madeToOrderContactChannels = [
  "telegram",
  "whatsapp",
  "max",
  "email",
] as const;

export const madeToOrderContactChannelSchema = z.enum(
  madeToOrderContactChannels,
  { error: "Выберите, где удобнее ответить" },
);

export type MadeToOrderContactChannel = z.infer<
  typeof madeToOrderContactChannelSchema
>;

export const TELEGRAM_HANDLE_ERROR =
  "Укажите ник в Telegram, например @anna_star";

/**
 * Ник из `@anna_star`, `anna_star`, `t.me/anna_star` или
 * `https://t.me/anna_star`. null — это не ник Telegram: ссылки с параметрами
 * (например, приглашение в бота) и номера телефонов не подходят.
 */
export function normalizeTelegramHandle(value: string): string | null {
  const trimmed = value.trim();
  const link = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.)?(?:t|telegram)\.me\/([^/?#\s]+)\/?$/i,
  );
  const handle = (link?.[1] ?? trimmed.replace(/^@/, "")).trim();
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(handle) ? `@${handle}` : null;
}

export const madeToOrderRequestSchema = z
  .object({
    contactName: z.string().trim().min(1).max(120),
    contactPhone: z.string().trim().min(5, "Укажите телефон").max(32),
    contactEmail: z.email("Укажите email").trim(),
    /**
     * Где удобнее ответить. Необязательно только для старых вкладок: раньше
     * выбора не было, и мастер звонил на телефон из заявки.
     */
    // phone сохраняем для запросов из вкладок с прежней формой «Звонок».
    preferredContactChannel: madeToOrderContactChannelSchema
      .or(z.literal("phone"))
      .optional(),
    /** Ник в Telegram; для остальных каналов сервер его не сохраняет. */
    contactMessenger: z.string().trim().max(120).optional(),
    customerNotes: z.string().trim().max(1500).optional(),
    // Пункт выдачи Ozon, куда отправить готовое изделие. Покупатель выбирает
    // его на странице заказа перед предоплатой; поле осталось для старых вкладок.
    deliveryPointId: z.string().trim().min(1).max(32).optional(),
    items: z
      .array(
        z.object({
          productSlug: z.string().min(1),
          quantity: z.number().int().positive().max(MAX_MADE_TO_ORDER_QUANTITY),
          // Мерки и комментарий покупатель добавляет на странице заказа.
          options: z.object({
            size: z.string().trim().min(1).max(60),
            color: z.string().trim().min(1).max(60),
          }),
        }),
      )
      .min(1)
      .max(MAX_MADE_TO_ORDER_LINES),
    // Отдельное согласие на обработку ПДн (ст. 9 152-ФЗ). Оферту покупатель
    // принимает позже — при предоплате, когда цена согласована.
    personalDataConsent,
  })
  .superRefine((data, ctx) => {
    if (data.preferredContactChannel !== "telegram") return;
    if (normalizeTelegramHandle(data.contactMessenger ?? "")) return;
    ctx.addIssue({
      code: "custom",
      path: ["contactMessenger"],
      message: TELEGRAM_HANDLE_ERROR,
    });
  });

export type MadeToOrderRequest = z.infer<typeof madeToOrderRequestSchema>;

export const madeToOrderRequestedSchema = z.object({
  orderId: z.string().min(1),
  /** Предварительная сумма по каталогу, рубли: для цели аналитики. */
  estimate: z.number().nonnegative(),
});

export type MadeToOrderRequested = z.infer<typeof madeToOrderRequestedSchema>;

/** Расчёт доставки изделий, которые производятся после оплаты. */
export const instantMadeToOrderQuoteSchema = z.object({
  available: z.boolean(),
  /** Почему недоступно, если `available` ложно. */
  reason: z.string().optional(),
  /** Стоимость доставки, копейки. */
  deliveryPriceKopecks: z.number().int().nonnegative(),
});

export type InstantMadeToOrderQuote = z.infer<
  typeof instantMadeToOrderQuoteSchema
>;

/** Проверка промокода новогоднего набора по актуальным ценам каталога. */
export const validateInstantPromoInputSchema = z.object({
  code: z.string().trim().min(3, "Введите промокод").max(40),
  items: z.array(stockItemSchema).min(1).max(MAX_MADE_TO_ORDER_LINES),
});

export type ValidateInstantPromoInput = z.infer<
  typeof validateInstantPromoInputSchema
>;

/** Результат проверки промокода; суммы в копейках. */
export const instantPromoValidationSchema = z.object({
  valid: z.boolean(),
  /** Почему промокод не применяется; null — применён. */
  reason: z.string().nullable(),
  /** Канонический код в верхнем регистре. */
  code: z.string().nullable(),
  discountType: z.enum(["percent", "fixed"]).nullable(),
  /** Процент или сумма в копейках — как настроено в админке. */
  discountValue: z.number().int().positive().nullable(),
  /** Скидка на текущий состав заказа. */
  discountKopecks: z.number().int().nonnegative().nullable(),
  /** Стоимость изделий до скидки. */
  productsKopecks: z.number().int().nonnegative(),
});

export type InstantPromoValidation = z.infer<
  typeof instantPromoValidationSchema
>;

/**
 * Мгновенное оформление изделий, которые производятся после оплаты: доставка
 * считается сразу по заранее известной посылке, без карточек и SKU Ozon Seller.
 */
export const createInstantMadeToOrderInputSchema = z.object({
  contactName: z.string().min(1).max(120),
  contactPhone: phone,
  contactEmail: z.email("Укажите email").trim(),
  comment: z.string().trim().max(1500).optional(),
  /** Промокод новогодней коллекции; сервер проверяет его заново. */
  promoCode: z.string().trim().min(3).max(40).optional(),
  items: z.array(stockItemSchema).min(1).max(MAX_MADE_TO_ORDER_LINES),
  delivery: pickupDeliverySchema,
  /** Не создаём платёж, если серверная доставка дороже показанной покупателю. */
  expectedDeliveryKopecks: z.number().int().nonnegative().optional(),
  /** Не создаём платёж, если серверная цена товаров выше показанной покупателю. */
  expectedProductsKopecks: z.number().int().positive().optional(),
  personalDataConsent,
  offerAccepted: z.literal(true, { error: "Подтвердите согласие с офертой" }),
});

export type CreateInstantMadeToOrderInput = z.infer<
  typeof createInstantMadeToOrderInputSchema
>;

export const checkoutContract = {
  /** Принимает ли Ozon Доставка заказы на этот телефон. */
  checkPhone: oc
    .errors({
      [DeliveryUnavailableError.code]: DeliveryUnavailableError,
      [CheckoutCheckFailedError.code]: CheckoutCheckFailedError,
    })
    .input(z.object({ phone }))
    .output(phoneCheckSchema),

  /** Стоимость и сроки доставки в выбранный пункт. */
  quote: oc
    .errors({
      [DeliveryUnavailableError.code]: DeliveryUnavailableError,
      [ItemsUnavailableError.code]: ItemsUnavailableError,
      [CheckoutCheckFailedError.code]: CheckoutCheckFailedError,
    })
    .input(quoteInputSchema)
    .output(checkoutQuoteSchema),

  /**
   * Проверяет товары и доставку, сохраняет заказ с атрибуцией из cookie и
   * возвращает ссылку на оплату и данные для аналитики.
   */
  create: oc
    .errors({
      [PaymentsUnavailableError.code]: PaymentsUnavailableError,
      [ItemsUnavailableError.code]: ItemsUnavailableError,
      [CheckoutCheckFailedError.code]: CheckoutCheckFailedError,
      [DeliveryNotAvailableError.code]: DeliveryNotAvailableError,
      [DeliveryPriceChangedError.code]: DeliveryPriceChangedError,
      [ProductsPriceChangedError.code]: ProductsPriceChangedError,
      [PaymentCreateFailedError.code]: PaymentCreateFailedError,
    })
    .input(createOrderInputSchema)
    .output(createdOrderSchema),

  /** Принимает ли Ozon Доставка для бизнеса заказы на этот телефон. */
  checkInstantMadeToOrderPhone: oc
    .errors({
      [DeliveryUnavailableError.code]: DeliveryUnavailableError,
      [CheckoutCheckFailedError.code]: CheckoutCheckFailedError,
    })
    .input(z.object({ phone }))
    .output(phoneCheckSchema),

  /** Стоимость доставки изделий с мгновенной оплатой в выбранный пункт. */
  quoteInstantMadeToOrder: oc
    .errors({
      [DeliveryUnavailableError.code]: DeliveryUnavailableError,
      [ItemsUnavailableError.code]: ItemsUnavailableError,
      [MinimumOrderNotMetError.code]: MinimumOrderNotMetError,
      [CheckoutCheckFailedError.code]: CheckoutCheckFailedError,
    })
    .input(quoteInputSchema)
    .output(instantMadeToOrderQuoteSchema),

  /** Проверяет промокод новогоднего набора и считает скидку по ценам сервера. */
  validateInstantMadeToOrderPromo: oc
    .errors({
      [ItemsUnavailableError.code]: ItemsUnavailableError,
      [MinimumOrderNotMetError.code]: MinimumOrderNotMetError,
      [CheckoutCheckFailedError.code]: CheckoutCheckFailedError,
    })
    .input(validateInstantPromoInputSchema)
    .output(instantPromoValidationSchema),

  /**
   * Проверяет состав и доставку, сохраняет заказ как полностью оплачиваемый
   * заранее и возвращает ссылку на оплату. После оплаты изделия уходят в
   * производство, а когда они готовы, отправление создаётся в Ozon Доставке
   * для бизнеса — карточки и SKU Ozon Seller для этого не нужны.
   */
  createInstantMadeToOrder: oc
    .errors({
      [PaymentsUnavailableError.code]: PaymentsUnavailableError,
      [ItemsUnavailableError.code]: ItemsUnavailableError,
      [MinimumOrderNotMetError.code]: MinimumOrderNotMetError,
      [CheckoutCheckFailedError.code]: CheckoutCheckFailedError,
      [DeliveryNotAvailableError.code]: DeliveryNotAvailableError,
      [DeliveryPriceChangedError.code]: DeliveryPriceChangedError,
      [ProductsPriceChangedError.code]: ProductsPriceChangedError,
      [PromoCodeInvalidError.code]: PromoCodeInvalidError,
      [PaymentCreateFailedError.code]: PaymentCreateFailedError,
    })
    .input(createInstantMadeToOrderInputSchema)
    .output(createdOrderSchema),

  /**
   * Заявка на изделия под заказ, без оплаты: мастер связывается с
   * покупателем, согласует цену и мерки и выставляет предоплату. Цены из
   * каталога стартовые. Пункт выдачи Ozon покупатель выбирает перед
   * предоплатой, а стоимость доставки Ozon посчитает, когда изделие готово.
   */
  requestMadeToOrder: oc
    .errors({
      [ItemsUnavailableError.code]: ItemsUnavailableError,
      [OptionsUnavailableError.code]: OptionsUnavailableError,
      [DeliveryPointUnavailableError.code]: DeliveryPointUnavailableError,
      [CheckoutCheckFailedError.code]: CheckoutCheckFailedError,
    })
    .input(madeToOrderRequestSchema)
    .output(madeToOrderRequestedSchema),
};
