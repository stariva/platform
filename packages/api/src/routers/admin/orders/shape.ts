import type {
  productOrderItems,
  productOrderPayments,
  productOrders,
} from "@stariva/db/schema";

type OrderRow = typeof productOrders.$inferSelect;
type OrderItemRow = typeof productOrderItems.$inferSelect;
type PaymentRow = typeof productOrderPayments.$inferSelect;
type OrderStatus = OrderRow["status"];

/** Товар каталога, на который ссылается позиция заказа. */
export interface ItemProduct {
  id: string;
  image: string | null;
}

const rubles = (kopecks: number) => kopecks / 100;

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : null;

/**
 * Адрес доставки: курьеру — адрес и координаты, в пункт выдачи — адрес
 * пункта, если сайт сохранил его при оформлении (старые заказы — только id).
 */
function deliveryAddress(order: OrderRow) {
  const raw = (order.deliveryAddress ?? {}) as Record<string, unknown>;
  const lat = typeof raw.lat === "number" ? raw.lat : null;
  const lng = typeof raw.lng === "number" ? raw.lng : null;
  return {
    address: text(raw.address),
    title: text(raw.title),
    locality: text(raw.locality),
    coordinates: lat !== null && lng !== null ? { lat, lng } : null,
  };
}

/** Способ и сроки доставки из ответа Ozon при оформлении. */
function ozonDelivery(order: OrderRow) {
  const snapshot = order.checkoutSnapshot as {
    splits?: {
      deliveryMethod?: {
        type?: string;
        logisticDateFrom?: string;
        logisticDateTo?: string;
      };
    }[];
  } | null;
  const method = snapshot?.splits?.[0]?.deliveryMethod;
  if (!method) return null;
  return {
    type: text(method.type),
    dateFrom: text(method.logisticDateFrom),
    dateTo: text(method.logisticDateTo),
  };
}

/** Заказ для админки: суммы в рублях, всё, что известно о заказе и доставке. */
export function toAdminOrder(
  order: OrderRow,
  items: OrderItemRow[],
  payments: PaymentRow[] = [],
  products: Map<string, ItemProduct> = new Map(),
) {
  return {
    id: order.id,
    number: order.number,
    kind: order.kind,
    status: order.status,
    userId: order.userId,
    contactName: order.contactName,
    contactPhone: order.contactPhone,
    contactEmail: order.contactEmail,
    amountTotal: rubles(order.amountTotal),
    amountProducts: rubles(order.amountProducts),
    amountDelivery: rubles(order.amountDelivery),
    depositAmount:
      order.depositAmount === null ? null : rubles(order.depositAmount),
    leadTime: order.leadTime,
    paymentDueAt: order.paymentDueAt,
    approvedAt: order.approvedAt,
    depositPaidAt: order.depositPaidAt,
    declineReason: order.declineReason,
    customerNotes: order.customerNotes,
    deliveryMethod: order.deliveryMethod,
    deliveryPointId: order.deliveryPointId,
    deliveryAddress: deliveryAddress(order),
    ozonDelivery: ozonDelivery(order),
    deliveryNote: order.deliveryNote,
    masterNotes: order.masterNotes,
    trackingNumber: order.trackingNumber,
    paymentId: order.paymentId,
    ozonOrderId: order.ozonOrderId,
    ozonPostingNumbers: order.ozonPostingNumbers ?? [],
    ozonShipmentStatus: order.ozonShipmentStatus,
    staffNotifiedAt: order.staffNotifiedAt,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    attribution: order.attribution,
    visitor: order.visitor,
    items: items.map((item) => {
      const product = products.get(item.productSlug);
      return {
        id: item.id,
        productSlug: item.productSlug,
        productId: product?.id ?? null,
        image: product?.image ?? null,
        ozonSku: item.ozonSku,
        name: item.name,
        quantity: item.quantity,
        price: rubles(item.price),
        options: item.options,
      };
    }),
    // Все попытки оплаты: неоплаченные ссылки тоже — чтобы видеть «зависшие»
    payments: [...payments]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((payment) => ({
        id: payment.id,
        type: payment.type,
        status: payment.status,
        amount: rubles(payment.amount),
        yookassaPaymentId: payment.yookassaPaymentId,
        createdAt: payment.createdAt,
        paidAt: payment.paidAt,
      })),
  };
}

export type AdminOrder = ReturnType<typeof toAdminOrder>;

/** Статусы, которые бывают у заказа каждого вида, в порядке жизни заказа. */
export const STATUSES_BY_KIND = {
  stock: [
    "pending",
    "paid",
    "fulfilling",
    "shipped",
    "delivered",
    "ozon_order_failed",
    "canceled",
    "refunded",
  ],
  made_to_order: [
    "requested",
    "awaiting_deposit",
    "in_production",
    "awaiting_balance",
    "ready_to_ship",
    "shipped",
    "delivered",
    "declined",
    "canceled",
    "refunded",
  ],
} as const satisfies Record<OrderRow["kind"], readonly OrderStatus[]>;

/**
 * В этих статусах покупатель может платить: им нужны сумма и срок оплаты,
 * поэтому вручную их не ставят — только оформление и кнопки этапов.
 */
export const PAYMENT_STATUSES = [
  "pending",
  "awaiting_deposit",
  "awaiting_balance",
] as const satisfies readonly OrderStatus[];

/** Можно ли вручную перевести заказ этого вида в `status`. */
export function isManualStatus(kind: OrderRow["kind"], status: OrderStatus) {
  return (
    (STATUSES_BY_KIND[kind] as readonly OrderStatus[]).includes(status) &&
    !(PAYMENT_STATUSES as readonly OrderStatus[]).includes(status)
  );
}
