import type { OrderServices } from "@stariva/web-api";
import { baseEnv, env } from "@/env";
import { LEGAL_VERSION } from "@/lib/legal";
import { getCachedPickupPointsInfo } from "@/lib/ozon-delivery/pickup-points-cache";
import { getPostingStatuses } from "@/lib/ozon-delivery/postings";
import type { DeliveryCheckoutResponse } from "@/lib/ozon-delivery/types";
import { createPayment, isYooKassaConfigured } from "@/lib/payments/yookassa";
import { phonesMatch } from "@/lib/phone";
import { isPaymentOverdue, madeToOrderPaymentStep } from "./made-to-order-flow";
import { quoteMadeToOrderDelivery } from "./made-to-order-shipment";
import {
  type MeasurementField,
  measurementFieldsBySlug,
} from "./measurement-fields";
import { notifyMadeToOrderDetailsUpdated } from "./order-notifications";
import { syncPendingProductOrder } from "./order-payment";
import {
  attachOrderPaymentConfirmation,
  createOrderPayment,
  findReusableOrderPayment,
  getProductCoverImages,
  getProductOrderById,
  getProductOrderCustomerEmail,
  getProductOrderItems,
  isDeliveryPointEditable,
  needsDeliveryPoint,
  setMadeToOrderDeliveryPoint,
  updateMadeToOrderDetails,
} from "./orders";

type ProductOrderRow = NonNullable<
  Awaited<ReturnType<typeof getProductOrderById>>
>;

const STAGE_DESCRIPTIONS = {
  deposit: "Предоплата",
  balance: "Доплата",
} as const;

/** Адрес сайта для ссылки возврата с оплаты: из окружения, иначе из запроса. */
export function siteUrl(headers: Headers): string {
  const configured = env.NEXT_PUBLIC_SITE_URL ?? baseEnv.APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const origin = headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const proto = headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host ?? "localhost:3000"}`;
}

/** Пункт, который выбрал покупатель; адреса нет, если Ozon тогда не ответил. */
function deliveryPointView(
  order: Pick<ProductOrderRow, "deliveryPointId" | "deliveryAddress">,
) {
  if (!order.deliveryPointId) return null;
  const raw = (order.deliveryAddress ?? {}) as {
    address?: unknown;
    title?: unknown;
  };
  return {
    title: typeof raw.title === "string" ? raw.title : null,
    address: typeof raw.address === "string" ? raw.address : null,
  };
}

/**
 * Ожидаемые даты доставки из расчёта Ozon при оформлении. Если заказ разбит
 * на несколько отправлений, ориентируемся на самое позднее — как форма
 * оформления, чтобы не обещать после оплаты срок раньше показанного до неё.
 */
export function deliveryDatesView(
  order: Pick<ProductOrderRow, "checkoutSnapshot">,
) {
  const snapshot = order.checkoutSnapshot as DeliveryCheckoutResponse | null;
  const methods = (snapshot?.splits ?? []).map((split) => split.deliveryMethod);
  const latest = (dates: (string | undefined)[]) =>
    dates
      .filter((iso): iso is string => typeof iso === "string")
      .filter((iso) => !Number.isNaN(new Date(iso).getTime()))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .at(-1);
  const from = latest(methods.map((method) => method?.logisticDateFrom));
  const to = latest(methods.map((method) => method?.logisticDateTo));
  if (!from || !to) return null;
  return { from, to };
}

/**
 * Гостевые заказы для процедур orders.*: подтверждение телефоном вместо
 * аккаунта, чтобы нельзя было подобрать чужой заказ, зная только id.
 */
export const orderServices: OrderServices = {
  async view({ orderId, phone }) {
    const found = await getProductOrderById(orderId);
    if (!found || !phonesMatch(found.contactPhone, phone)) return null;
    // Вебхук мог потеряться: оплаченный заказ не должен висеть в «ожидает оплаты»
    const order = await syncPendingProductOrder(found);

    const [items, email] = await Promise.all([
      getProductOrderItems(orderId),
      getProductOrderCustomerEmail(order),
    ]);
    const covers = await getProductCoverImages(items.map((i) => i.productSlug));
    // Посылка под заказ идёт через Delivery API, Seller API её статусы не знает
    const postings =
      order.kind === "stock"
        ? await getPostingStatuses(order.ozonPostingNumbers)
        : [];
    const fields =
      order.kind === "made_to_order"
        ? await measurementFieldsBySlug(items.map((item) => item.productSlug))
        : new Map<string, MeasurementField[]>();

    return {
      number: order.number,
      kind: order.kind,
      status: order.status,
      paid: Boolean(order.paidAt),
      amountTotal: order.amountTotal,
      amountProducts: order.amountProducts,
      amountDelivery: order.amountDelivery,
      depositAmount: order.depositAmount,
      depositPaid: Boolean(order.depositPaidAt),
      leadTime: order.leadTime,
      paymentDueAt: order.paymentDueAt?.toISOString() ?? null,
      paymentOverdue: isPaymentOverdue(order),
      paymentStep: madeToOrderPaymentStep(order),
      declineReason: order.declineReason,
      createdAt: order.createdAt.toISOString(),
      deliveryMethod: order.deliveryMethod,
      customerNotes: order.customerNotes,
      deliveryNote: order.deliveryNote,
      deliveryPoint: deliveryPointView(order),
      deliveryPointEditable: isDeliveryPointEditable(order),
      deliveryDates: deliveryDatesView(order),
      hasEmail: Boolean(email),
      trackingNumber: order.trackingNumber,
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        image: covers.get(i.productSlug) ?? null,
        options: i.options,
        measurementFields: fields.get(i.productSlug) ?? [],
      })),
      postings,
    };
  },

  async updateDetails({ orderId, phone, ...details }) {
    const order = await getProductOrderById(orderId);
    if (
      order?.kind !== "made_to_order" ||
      !phonesMatch(order.contactPhone, phone)
    ) {
      return "not_found";
    }
    if (!(await updateMadeToOrderDetails(orderId, details))) return "locked";
    await notifyMadeToOrderDetailsUpdated(orderId);
    return "ok";
  },

  async updateDeliveryPoint({ orderId, phone, pointId }) {
    const order = await getProductOrderById(orderId);
    if (
      order?.kind !== "made_to_order" ||
      !phonesMatch(order.contactPhone, phone)
    ) {
      return "not_found";
    }
    if (!isDeliveryPointEditable(order)) return "locked";

    // Если Ozon не ответил, пункт всё равно запоминаем: выбор важнее адреса,
    // а расчёт доставки проверит пункт ещё раз
    const info = await getCachedPickupPointsInfo([pointId]).catch(
      (error: unknown) => {
        console.warn("[orders] Не удалось получить адрес пункта:", error);
        return null;
      },
    );
    if (info?.unavailable.includes(pointId)) return "unavailable";

    const saved = await setMadeToOrderDeliveryPoint(
      orderId,
      pointId,
      info?.points[0] ?? null,
    );
    if (!saved) return "locked";
    await notifyMadeToOrderDetailsUpdated(orderId);
    return "ok";
  },

  quoteMadeToOrderDelivery,

  async startPayment({ orderId, phone, returnTo, headers }) {
    if (!isYooKassaConfigured()) return { status: "unavailable" };

    const order = await getProductOrderById(orderId);
    if (
      order?.kind !== "made_to_order" ||
      !phonesMatch(order.contactPhone, phone)
    ) {
      return { status: "not_found" };
    }

    const step = madeToOrderPaymentStep(order);
    if (!step) {
      return {
        status: isPaymentOverdue(order) ? "overdue" : "nothing_to_pay",
      };
    }
    if (step.type === "deposit" && needsDeliveryPoint(order)) {
      return { status: "delivery_point_required" };
    }

    const reusable = await findReusableOrderPayment(
      orderId,
      step.type,
      step.amount,
    );
    if (reusable?.confirmationUrl) {
      return { status: "ok", confirmationUrl: reusable.confirmationUrl };
    }

    const paymentRowId = await createOrderPayment(
      orderId,
      step.type,
      step.amount,
    );
    try {
      const payment = await createPayment({
        amountKopecks: step.amount,
        description: `${STAGE_DESCRIPTIONS[step.type]} по заказу Stariva №${order.number}`,
        returnUrl:
          returnTo === "account"
            ? `${siteUrl(headers)}/account/orders/${orderId}?payment=success`
            : `${siteUrl(headers)}/order/${orderId}?payment=success`,
        metadata: {
          orderId,
          kind: "product",
          orderPaymentId: paymentRowId,
          paymentType: step.type,
          // Фиксация акцепта оферты: редакция документов на момент оплаты.
          offerAccepted: LEGAL_VERSION,
        },
        idempotenceKey: paymentRowId,
      });

      const confirmationUrl = payment.confirmation?.confirmation_url;
      if (!confirmationUrl) return { status: "failed" };
      await attachOrderPaymentConfirmation(
        paymentRowId,
        payment.id,
        confirmationUrl,
      );
      return { status: "ok", confirmationUrl };
    } catch (error) {
      console.error(`[orders/pay] Ошибка создания платежа ${orderId}:`, error);
      return { status: "failed" };
    }
  },
};
