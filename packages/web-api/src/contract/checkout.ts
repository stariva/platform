import { error, oc } from "@orpc/contract";
import { z } from "zod";
import { PaymentCreateFailedError, PaymentsUnavailableError } from "./orders";

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
 * Товары из корзины сняты с продажи или раскуплены. Витрина убирает их из
 * корзины по списку.
 */
export const ItemsUnavailableError = error("ITEMS_UNAVAILABLE", {
  message: "Некоторых товаров из корзины уже нет в наличии",
  data: z.object({ unavailableProductSlugs: z.array(z.string()).min(1) }),
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

const phone = z.string().min(5, "Укажите телефон").max(32);

const stockItemSchema = z.object({
  productSlug: z.string().min(1),
  quantity: z.number().int().positive().max(99),
});

const pickupDeliverySchema = z.object({
  method: z.literal("pickup"),
  pointId: z.string().min(1),
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
});

export type CheckoutQuote = z.infer<typeof checkoutQuoteSchema>;

export const createOrderInputSchema = z.object({
  contactName: z.string().min(1).max(120),
  contactPhone: phone,
  contactEmail: z.email().optional(),
  comment: z.string().trim().max(1500).optional(),
  items: z.array(stockItemSchema).min(1).max(100),
  delivery: pickupDeliverySchema,
  // Отдельное согласие на обработку ПДн (ст. 9 152-ФЗ) и акцепт оферты.
  personalDataConsent,
  offerAccepted: z.literal(true, { error: "Подтвердите согласие с офертой" }),
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

export const madeToOrderRequestSchema = z.object({
  contactName: z.string().trim().min(1).max(120),
  contactPhone: z.string().trim().min(5, "Укажите телефон").max(32),
  contactEmail: z.email().trim().optional(),
  customerNotes: z.string().trim().max(1500).optional(),
  deliveryNote: z.string().trim().max(1000).optional(),
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
});

export type MadeToOrderRequest = z.infer<typeof madeToOrderRequestSchema>;

export const madeToOrderRequestedSchema = z.object({
  orderId: z.string().min(1),
  /** Предварительная сумма по каталогу, рубли: для цели аналитики. */
  estimate: z.number().nonnegative(),
});

export type MadeToOrderRequested = z.infer<typeof madeToOrderRequestedSchema>;

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
      [PaymentCreateFailedError.code]: PaymentCreateFailedError,
    })
    .input(createOrderInputSchema)
    .output(createdOrderSchema),

  /**
   * Заявка на изделия под заказ, без оплаты: мастер связывается с
   * покупателем, согласует цену, мерки и доставку и выставляет предоплату.
   * Цены из каталога стартовые; Ozon Доставка не участвует.
   */
  requestMadeToOrder: oc
    .errors({
      [ItemsUnavailableError.code]: ItemsUnavailableError,
      [OptionsUnavailableError.code]: OptionsUnavailableError,
      [CheckoutCheckFailedError.code]: CheckoutCheckFailedError,
    })
    .input(madeToOrderRequestSchema)
    .output(madeToOrderRequestedSchema),
};
