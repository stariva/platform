import type { CheckoutQuote, CheckoutServices } from "@stariva/web-api";
import { attributionFromRequest } from "@/lib/campaign-attribution";
import { LEGAL_VERSION } from "@/lib/legal";
import { isOzonDeliveryConfigured } from "@/lib/ozon-delivery/auth";
import { checkDeliveryAvailable, checkout } from "@/lib/ozon-delivery/client";
import { getCachedPickupPointsInfo } from "@/lib/ozon-delivery/pickup-points-cache";
import type { DeliveryCheckoutResponse } from "@/lib/ozon-delivery/types";
import { createPayment, isYooKassaConfigured } from "@/lib/payments/yookassa";
import { collectVisitor } from "@/lib/visitor";
import {
  CatalogItemsUnavailableError,
  MadeToOrderOptionsError,
  resolveCatalogItems,
  resolveMadeToOrderItems,
} from "./catalog";
import {
  notifyCustomer,
  notifyMadeToOrderRequested,
} from "./order-notifications";
import { siteUrl } from "./order-services";
import {
  attachPaymentId,
  createMadeToOrderOrder,
  createProductOrder,
} from "./orders";

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
      console.error("[checkout/quote] Ошибка:", error);
      return { status: "check_failed" };
    }
  },

  async create({ userId, headers, ...data }) {
    if (!isYooKassaConfigured() || !isOzonDeliveryConfigured()) {
      return { status: "unconfigured" };
    }

    let items: Awaited<ReturnType<typeof resolveCatalogItems>>;
    let deliveryQuote: DeliveryCheckoutResponse;
    try {
      items = await resolveCatalogItems(data.items);
      deliveryQuote = await checkout({
        items: items.map((item) => ({
          sku: item.ozonSku,
          quantity: item.quantity,
        })),
        delivery: data.delivery,
        buyerPhone: data.contactPhone,
      });
    } catch (error) {
      if (error instanceof CatalogItemsUnavailableError) {
        return unavailableItems(error);
      }
      console.error("[checkout/create] Ошибка проверки заказа:", error);
      return { status: "check_failed" };
    }

    if (!deliveryQuote.available) return { status: "delivery_unavailable" };

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

    const order = await createProductOrder({
      userId: userId ?? undefined,
      attribution: attributionFromRequest({ headers }),
      visitor: await collectVisitor({ headers }),
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      comment: data.comment,
      items,
      delivery: data.delivery,
      pickupPoint,
      checkout: deliveryQuote,
    });

    try {
      const payment = await createPayment({
        amountKopecks: order.amountTotal,
        description: `Заказ Stariva №${order.number}`,
        returnUrl: `${siteUrl(headers)}/order/${order.id}?payment=success`,
        metadata: {
          orderId: order.id,
          kind: "product",
          // Фиксация согласия и акцепта: редакция документов на момент заказа.
          pdConsent: LEGAL_VERSION,
          offerAccepted: LEGAL_VERSION,
        },
        idempotenceKey: order.id,
      });

      await attachPaymentId(order.id, payment.id);

      const confirmationUrl = payment.confirmation?.confirmation_url;
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

    const order = await createMadeToOrderOrder({
      userId: userId ?? undefined,
      attribution: attributionFromRequest({ headers }),
      visitor: await collectVisitor({ headers }),
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      customerNotes: data.customerNotes,
      deliveryNote: data.deliveryNote,
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
