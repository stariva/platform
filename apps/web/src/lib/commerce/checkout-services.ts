import type { CheckoutQuote, CheckoutServices } from "@stariva/web-api";
import { normalizeTelegramHandle } from "@stariva/web-api/contract";
import { attributionFromRequest } from "@/lib/campaign-attribution";
import { LEGAL_VERSION } from "@/lib/legal";
import { MADE_TO_ORDER_DAYS } from "@/lib/made-to-order";
import { NEW_YEAR_PARCEL } from "@/lib/new-year";
import {
  checkBusinessDeliveryClient,
  isOzonBusinessDeliveryConfigured,
  quoteParcel,
} from "@/lib/ozon-business-delivery/client";
import { isOzonBusinessOutage } from "@/lib/ozon-business-delivery/errors";
import { isOzonDeliveryConfigured } from "@/lib/ozon-delivery/auth";
import { checkDeliveryAvailable, checkout } from "@/lib/ozon-delivery/client";
import { isOzonInfrastructureError } from "@/lib/ozon-delivery/errors";
import { getCachedPickupPointsInfo } from "@/lib/ozon-delivery/pickup-points-cache";
import type { DeliveryCheckoutResponse } from "@/lib/ozon-delivery/types";
import {
  createInvoice,
  isRobokassaConfigured,
  paymentUrl,
  robokassaPaymentId,
} from "@/lib/payments/robokassa";
import { createPayment, isYooKassaConfigured } from "@/lib/payments/yookassa";
import { collectVisitor } from "@/lib/visitor";
import {
  CatalogItemsUnavailableError,
  MadeToOrderOptionsError,
  NewYearMinimumOrderError,
  resolveCatalogItems,
  resolveInstantMadeToOrderItems,
  resolveMadeToOrderItems,
} from "./catalog";
import { priceKitBundleLines, resolveKitOrderGift } from "./elka-kit-bundle";
import { hasPurchasedElkaWorkshop } from "./elka-kit-offer";
import { FALLBACK_DELIVERY_PRICE_KOPECKS } from "./made-to-order-flow";
import {
  notifyCustomer,
  notifyMadeToOrderRequested,
} from "./order-notifications";
import { siteUrl } from "./order-services";
import {
  attachOrderPaymentConfirmation,
  attachPaymentId,
  createInstantMadeToOrderOrder,
  createMadeToOrderOrder,
  createOrderPayment,
  createProductOrder,
  InstantOrderTotalChangedError,
} from "./orders";
import { PromoCodeInvalidError, validateStoredPromoCode } from "./promo-codes";

/**
 * Расчёта нет, потому что Ozon не ответил: покупателю доставка бесплатна, а
 * мастер отправит заказ вручную. Такой «расчёт» не блокирует оформление.
 */
function manualQuote(): CheckoutQuote {
  return {
    available: true,
    deliveryPriceKopecks: 0,
    shipments: [],
    manual: true,
  };
}

/** Расчёт Ozon без внутренних полей: покупателю нужны цена и даты. */
function toQuote(result: DeliveryCheckoutResponse): CheckoutQuote {
  return {
    available: result.available,
    reason: result.reason,
    deliveryPriceKopecks: result.deliveryPriceKopecks,
    shipments: result.splits.map((split) => ({
      dateFrom: split.deliveryMethod.logisticDateFrom,
      dateTo: split.deliveryMethod.logisticDateTo,
    })),
  };
}

function unavailableItems(error: CatalogItemsUnavailableError) {
  console.warn("[checkout] Товары недоступны:", error.productSlugs);
  return {
    status: "items_unavailable",
    unavailableProductSlugs: error.productSlugs,
  } as const;
}

type InstantDeliveryQuote =
  | {
      available: true;
      deliveryPriceKopecks: number;
      fallback?: boolean;
    }
  | { available: false; reason: string; deliveryPriceKopecks: 0 };

/** Причины quoteParcel написаны для мастера; покупателю подсказка про ручную цену не нужна. */
function customerQuoteReason(reason: string | undefined): string {
  return (
    reason?.replace(/\. Можно указать стоимость вручную$/, "") ??
    "Ozon не доставит такой заказ в этот пункт"
  );
}

/**
 * Считает доставку новогоднего набора через Ozon Delivery for Business. При
 * временном сбое Ozon покупатель не теряется: берём ту же цену-заглушку, что и
 * в обычных заказах под заказ. Перед отправкой Ozon пересчитает доставку
 * заново, а разницу мастер увидит в уведомлении.
 */
async function quoteInstantParcel(input: {
  contactPhone: string;
  delivery: { pointId: string };
  items: { price: number; quantity: number }[];
}): Promise<InstantDeliveryQuote> {
  const declaredValueKopecks = input.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  try {
    const quote = await quoteParcel({
      recipientPhone: input.contactPhone,
      pointId: input.delivery.pointId,
      parcel: NEW_YEAR_PARCEL,
      declaredValueKopecks,
    });
    if (!quote.available) {
      return {
        available: false,
        reason: customerQuoteReason(quote.reason),
        deliveryPriceKopecks: 0,
      };
    }
    return { available: true, deliveryPriceKopecks: quote.priceKopecks };
  } catch (error) {
    if (!isOzonBusinessOutage(error)) throw error;
    console.warn(
      "[checkout/instant] Ozon Business недоступен, используем цену-заглушку:",
      error,
    );
    return {
      available: true,
      deliveryPriceKopecks: FALLBACK_DELIVERY_PRICE_KOPECKS,
      fallback: true,
    };
  }
}

/**
 * Оформление заказа для процедур checkout.*: каталог, Ozon Доставка, ЮKassa,
 * атрибуция из cookie и уведомления мастеру.
 */
export const checkoutServices: CheckoutServices = {
  async checkPhone(phone) {
    if (!isOzonDeliveryConfigured()) return { status: "unconfigured" };
    try {
      return { status: "ok", check: await checkDeliveryAvailable(phone) };
    } catch (error) {
      // Проверка телефона — подсказка, а не условие заказа: если Ozon лежит,
      // пропускаем её, чтобы покупатель мог оформить заказ
      if (isOzonInfrastructureError(error)) {
        console.warn(
          "[checkout/delivery-check] Ozon недоступен, проверку телефона пропускаем:",
          error,
        );
        return { status: "ok", check: { available: true } };
      }
      console.error("[checkout/delivery-check] Ошибка:", error);
      return { status: "check_failed" };
    }
  },

  async quote(input) {
    if (!isOzonDeliveryConfigured()) return { status: "unconfigured" };
    try {
      const items = await resolveCatalogItems(input.items);
      const result = await checkout({
        items: items.map((item) => ({
          sku: item.ozonSku,
          quantity: item.quantity,
        })),
        delivery: input.delivery,
        buyerPhone: input.contactPhone,
      });
      return { status: "ok", quote: toQuote(result) };
    } catch (error) {
      if (error instanceof CatalogItemsUnavailableError) {
        return unavailableItems(error);
      }
      if (isOzonInfrastructureError(error)) {
        console.warn(
          "[checkout/quote] Ozon недоступен, считаем доставку вручную:",
          error,
        );
        return { status: "ok", quote: manualQuote() };
      }
      console.error("[checkout/quote] Ошибка:", error);
      return { status: "check_failed" };
    }
  },

  async create({ userId, headers, paymentProvider = "yookassa", ...data }) {
    const paymentsConfigured =
      paymentProvider === "robokassa"
        ? isRobokassaConfigured()
        : isYooKassaConfigured();
    if (!paymentsConfigured || !isOzonDeliveryConfigured()) {
      return { status: "unconfigured" };
    }

    let items: Awaited<ReturnType<typeof resolveCatalogItems>>;
    try {
      items = await resolveCatalogItems(data.items, {
        elkaKitOwner:
          !data.kitAccessMode && userId
            ? await hasPurchasedElkaWorkshop(userId)
            : false,
      });
    } catch (error) {
      if (error instanceof CatalogItemsUnavailableError) {
        return unavailableItems(error);
      }
      console.error("[checkout/create] Ошибка проверки заказа:", error);
      return { status: "check_failed" };
    }

    if (data.kitAccessMode) {
      const priced = priceKitBundleLines(items, data.kitAccessMode);
      if (!priced) return { status: "check_failed" };
      items = priced;
    }
    const productsKopecks = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    if (
      data.expectedProductsKopecks !== undefined &&
      productsKopecks > data.expectedProductsKopecks
    ) {
      return { status: "products_price_changed" };
    }

    // null — Ozon не ответил: заказ принимаем с ручной доставкой, бесплатной
    // для покупателя. Решает сервер, а не клиент: просто так бесплатную
    // доставку не получить
    let deliveryQuote: DeliveryCheckoutResponse | null;
    try {
      deliveryQuote = await checkout({
        items: items.map((item) => ({
          sku: item.ozonSku,
          quantity: item.quantity,
        })),
        delivery: data.delivery,
        buyerPhone: data.contactPhone,
      });
    } catch (error) {
      if (!isOzonInfrastructureError(error)) {
        console.error("[checkout/create] Ошибка проверки заказа:", error);
        return { status: "check_failed" };
      }
      console.warn(
        "[checkout/create] Ozon недоступен, оформляем с ручной доставкой:",
        error,
      );
      deliveryQuote = null;
    }

    if (deliveryQuote && !deliveryQuote.available) {
      return { status: "delivery_unavailable" };
    }

    // Покупатель не должен заплатить за доставку больше, чем видел
    const deliveryKopecks = deliveryQuote?.deliveryPriceKopecks ?? 0;
    if (
      data.expectedDeliveryKopecks !== undefined &&
      deliveryKopecks > data.expectedDeliveryKopecks
    ) {
      return { status: "delivery_price_changed" };
    }

    // Адрес пункта нужен только мастеру в админке — без него заказ всё равно оформляем
    const pickupPoint = await getCachedPickupPointsInfo([data.delivery.pointId])
      .then(({ points }) => points[0] ?? null)
      .catch((error: unknown) => {
        console.warn(
          "[checkout/create] Не удалось получить адрес пункта:",
          error,
        );
        return null;
      });

    // Ручной заказ без адреса пункта мастер не отправит: Ozon ничего не
    // подскажет, значит, адрес должен прийти от покупателя (так делает
    // страница; не пришёл — старая вкладка, пусть оформит заново)
    if (!deliveryQuote && !pickupPoint && !data.delivery.pointLabel?.trim()) {
      console.error(
        `[checkout/create] Ozon недоступен, а адреса пункта ${data.delivery.pointId} нет: ручной заказ не принимаем`,
      );
      return { status: "check_failed" };
    }

    let order: Awaited<ReturnType<typeof createProductOrder>>;
    try {
      order = await createProductOrder({
        userId: userId ?? undefined,
        attribution: attributionFromRequest({ headers }),
        visitor: await collectVisitor({ headers }),
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        comment: data.comment,
        gift: resolveKitOrderGift(data.kitAccessMode, data.gift),
        kitAccessMode: data.kitAccessMode,
        items,
        delivery: data.delivery,
        pickupPoint,
        pointLabel: data.delivery.pointLabel,
        checkout: deliveryQuote,
      });
    } catch (error) {
      if (error instanceof CatalogItemsUnavailableError) {
        return unavailableItems(error);
      }
      console.error("[checkout/create] Ошибка сохранения заказа:", error);
      return { status: "check_failed" };
    }

    const description = `Заказ Stariva №${order.number}`;
    // Фиксация согласия и акцепта: редакция документов на момент заказа.
    const consents = { pdConsent: LEGAL_VERSION, offerAccepted: LEGAL_VERSION };

    try {
      let confirmationUrl: string | undefined;
      if (paymentProvider === "robokassa") {
        const invoice = await createInvoice(
          { kind: "product", orderId: order.id },
          order.amountTotal,
        );
        await attachPaymentId(order.id, robokassaPaymentId(invoice.id));
        confirmationUrl = paymentUrl(invoice, description, consents);
      } else {
        const payment = await createPayment({
          amountKopecks: order.amountTotal,
          description,
          returnUrl: `${siteUrl(headers)}/order/${order.id}?payment=success`,
          metadata: { orderId: order.id, kind: "product", ...consents },
          idempotenceKey: order.id,
        });
        await attachPaymentId(order.id, payment.id);
        confirmationUrl = payment.confirmation?.confirmation_url;
      }
      if (!confirmationUrl) return { status: "payment_failed" };

      return {
        status: "ok",
        order: {
          confirmationUrl,
          orderId: order.id,
          orderNumber: order.number,
          analytics: {
            id: order.id,
            revenue: order.amountTotal / 100,
            products: items.map((item) => ({
              id: item.productSlug,
              name: item.name,
              price: item.price / 100,
              quantity: item.quantity,
            })),
          },
        },
      };
    } catch (error) {
      console.error("[checkout/create] Ошибка создания платежа:", error);
      return { status: "payment_failed" };
    }
  },

  async checkInstantMadeToOrderPhone(phone) {
    if (!isOzonBusinessDeliveryConfigured()) return { status: "unconfigured" };
    try {
      return { status: "ok", check: await checkBusinessDeliveryClient(phone) };
    } catch (error) {
      // Проверка телефона — подсказка, а не условие заказа: временный сбой
      // Ozon не должен останавливать оформление
      if (isOzonBusinessOutage(error)) {
        console.warn(
          "[checkout/instant-check] Ozon недоступен, проверку телефона пропускаем:",
          error,
        );
        return { status: "ok", check: { available: true } };
      }
      console.error("[checkout/instant-check] Ошибка:", error);
      return { status: "check_failed" };
    }
  },

  async quoteInstantMadeToOrder(input) {
    if (!isOzonBusinessDeliveryConfigured()) return { status: "unconfigured" };
    try {
      const items = await resolveInstantMadeToOrderItems(input.items);
      const result = await quoteInstantParcel({ ...input, items });
      return {
        status: "ok",
        quote: {
          available: result.available,
          ...(result.available ? {} : { reason: result.reason }),
          deliveryPriceKopecks: result.deliveryPriceKopecks,
        },
      };
    } catch (error) {
      if (error instanceof CatalogItemsUnavailableError) {
        return unavailableItems(error);
      }
      if (error instanceof NewYearMinimumOrderError) {
        return {
          status: "minimum_order_not_met",
          minimum: error.minimum,
          quantity: error.quantity,
        };
      }
      console.error("[checkout/instant-quote] Ошибка:", error);
      return { status: "check_failed" };
    }
  },

  async validateInstantMadeToOrderPromo(input) {
    try {
      const items = await resolveInstantMadeToOrderItems(input.items);
      const productsKopecks = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      const evaluation = await validateStoredPromoCode(
        input.code,
        productsKopecks,
      );
      return {
        status: "ok",
        validation: { ...evaluation, productsKopecks },
      };
    } catch (error) {
      if (error instanceof CatalogItemsUnavailableError) {
        return unavailableItems(error);
      }
      if (error instanceof NewYearMinimumOrderError) {
        return {
          status: "minimum_order_not_met",
          minimum: error.minimum,
          quantity: error.quantity,
        };
      }
      console.error("[checkout/instant-promo] Ошибка:", error);
      return { status: "check_failed" };
    }
  },

  async createInstantMadeToOrder({ userId, headers, ...data }) {
    if (!isYooKassaConfigured() || !isOzonBusinessDeliveryConfigured()) {
      return { status: "unconfigured" };
    }

    let items: Awaited<ReturnType<typeof resolveInstantMadeToOrderItems>>;
    try {
      items = await resolveInstantMadeToOrderItems(data.items);
    } catch (error) {
      if (error instanceof CatalogItemsUnavailableError) {
        return unavailableItems(error);
      }
      if (error instanceof NewYearMinimumOrderError) {
        return {
          status: "minimum_order_not_met",
          minimum: error.minimum,
          quantity: error.quantity,
        };
      }
      console.error("[checkout/instant-create] Ошибка проверки заказа:", error);
      return { status: "check_failed" };
    }

    const productsKopecks = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    if (
      data.expectedProductsKopecks !== undefined &&
      productsKopecks > data.expectedProductsKopecks
    ) {
      return { status: "products_price_changed" };
    }

    let deliveryQuote: InstantDeliveryQuote;
    try {
      deliveryQuote = await quoteInstantParcel({ ...data, items });
    } catch (error) {
      console.error(
        "[checkout/instant-create] Ошибка расчёта доставки:",
        error,
      );
      return { status: "check_failed" };
    }
    if (!deliveryQuote.available) return { status: "delivery_unavailable" };
    if (
      data.expectedDeliveryKopecks !== undefined &&
      deliveryQuote.deliveryPriceKopecks > data.expectedDeliveryKopecks
    ) {
      return { status: "delivery_price_changed" };
    }

    // Адрес пункта нужен мастеру в админке и покупателю на странице заказа.
    // Если справочник точек не ответил, остаётся подпись от покупателя.
    const pickupPoint = await getCachedPickupPointsInfo([data.delivery.pointId])
      .then(({ points }) => points[0] ?? null)
      .catch((error: unknown) => {
        console.warn(
          "[checkout/instant-create] Не удалось получить адрес пункта:",
          error,
        );
        return null;
      });

    let order: Awaited<ReturnType<typeof createInstantMadeToOrderOrder>>;
    try {
      order = await createInstantMadeToOrderOrder({
        userId: userId ?? undefined,
        attribution: attributionFromRequest({ headers }),
        visitor: await collectVisitor({ headers }),
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        comment: data.comment,
        promoCode: data.promoCode,
        expectedTotalKopecks: data.expectedTotalKopecks,
        items,
        deliveryPointId: data.delivery.pointId,
        pickupPoint,
        pointLabel: data.delivery.pointLabel,
        amountDelivery: deliveryQuote.deliveryPriceKopecks,
        parcel: NEW_YEAR_PARCEL,
        priceFallback: deliveryQuote.available
          ? deliveryQuote.fallback === true
          : false,
        leadTime: MADE_TO_ORDER_DAYS,
      });
    } catch (error) {
      if (error instanceof InstantOrderTotalChangedError) {
        return { status: "order_total_changed" };
      }
      if (error instanceof PromoCodeInvalidError) {
        return { status: "promo_code_invalid", reason: error.reason };
      }
      console.error(
        "[checkout/instant-create] Ошибка сохранения заказа:",
        error,
      );
      return { status: "check_failed" };
    }

    const paymentRowId = await createOrderPayment(
      order.id,
      "deposit",
      order.amountTotal,
    );
    try {
      const payment = await createPayment({
        amountKopecks: order.amountTotal,
        description: `Заказ Stariva №${order.number}`,
        returnUrl: `${siteUrl(headers)}/order/${order.id}?payment=success`,
        metadata: {
          orderId: order.id,
          kind: "product",
          orderPaymentId: paymentRowId,
          paymentType: "deposit",
          // Фиксация согласия и акцепта: редакция документов на момент заказа.
          pdConsent: LEGAL_VERSION,
          offerAccepted: LEGAL_VERSION,
        },
        idempotenceKey: paymentRowId,
      });
      const confirmationUrl = payment.confirmation?.confirmation_url;
      if (!confirmationUrl) return { status: "payment_failed" };
      await attachOrderPaymentConfirmation(
        paymentRowId,
        payment.id,
        confirmationUrl,
      );

      return {
        status: "ok",
        order: {
          confirmationUrl,
          orderId: order.id,
          orderNumber: order.number,
          analytics: {
            id: order.id,
            revenue: order.amountTotal / 100,
            products: items.map((item) => ({
              id: item.productSlug,
              name: item.name,
              price: item.price / 100,
              quantity: item.quantity,
            })),
          },
        },
      };
    } catch (error) {
      console.error(
        "[checkout/instant-create] Ошибка создания платежа:",
        error,
      );
      return { status: "payment_failed" };
    }
  },

  async requestMadeToOrder({ userId, headers, ...data }) {
    let items: Awaited<ReturnType<typeof resolveMadeToOrderItems>>;
    try {
      items = await resolveMadeToOrderItems(
        data.items.map((item) => ({
          productSlug: item.productSlug,
          quantity: item.quantity,
          options: { ...item.options, measurements: [] },
        })),
      );
    } catch (error) {
      if (error instanceof CatalogItemsUnavailableError) {
        return unavailableItems(error);
      }
      if (error instanceof MadeToOrderOptionsError) {
        return { status: "options_unavailable" };
      }
      console.error("[checkout/made-to-order] Ошибка проверки заявки:", error);
      return { status: "check_failed" };
    }

    // Пункт покупатель выбирает перед предоплатой; в заявке он приходит только
    // из старых вкладок. Если Ozon не ответил, заявку не теряем: адрес пункта
    // нужен для показа, а сам пункт ещё раз проверит расчёт доставки
    const pointId = data.deliveryPointId;
    const pointInfo = pointId
      ? await getCachedPickupPointsInfo([pointId]).catch((error: unknown) => {
          console.warn(
            "[checkout/made-to-order] Не удалось получить адрес пункта:",
            error,
          );
          return null;
        })
      : null;
    if (pointId && pointInfo?.unavailable.includes(pointId)) {
      return { status: "delivery_point_unavailable" };
    }

    const order = await createMadeToOrderOrder({
      userId: userId ?? undefined,
      attribution: attributionFromRequest({ headers }),
      visitor: await collectVisitor({ headers }),
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      preferredContactChannel: data.preferredContactChannel ?? null,
      contactMessenger:
        data.preferredContactChannel === "telegram"
          ? normalizeTelegramHandle(data.contactMessenger ?? "")
          : null,
      customerNotes: data.customerNotes,
      deliveryPointId: pointId ?? null,
      pickupPoint: pointInfo?.points[0] ?? null,
      items,
    });

    await Promise.all([
      notifyMadeToOrderRequested(order.id),
      notifyCustomer(order.id),
    ]);

    return {
      status: "ok",
      request: {
        orderId: order.id,
        // Предварительная сумма по каталогу — для цели в аналитике, не для покупки
        estimate: order.amountTotal / 100,
      },
    };
  },
};
