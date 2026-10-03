/** Заказ в том виде, в каком его отдаёт `admin.orders.*` (даты уже строками). */
export interface AdminOrderView {
  id: string;
  kind: "stock" | "made_to_order";
  status: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  amountTotal: number;
  amountProducts: number;
  amountDelivery: number;
  depositAmount: number | null;
  leadTime: string | null;
  paymentDueAt: string | null;
  approvedAt: string | null;
  depositPaidAt: string | null;
  declineReason: string | null;
  customerNotes: string | null;
  deliveryNote: string | null;
  masterNotes: string | null;
  trackingNumber: string | null;
  ozonOrderId: string | null;
  createdAt: string;
  paidAt: string | null;
  items: {
    id: string;
    productSlug: string;
    name: string;
    quantity: number;
    price: number;
    options: {
      size: string;
      color: string;
      measurements: { label: string; value: string }[];
      comment?: string;
    } | null;
  }[];
  payments: {
    id: string;
    type: "deposit" | "balance";
    amount: number;
    paidAt: string | null;
  }[];
}

type DateFields =
  | "createdAt"
  | "paidAt"
  | "paymentDueAt"
  | "approvedAt"
  | "depositPaidAt";

/** Заказ, как его возвращает API: даты ещё объекты Date. */
export type AdminOrderData = Omit<AdminOrderView, DateFields | "payments"> & {
  createdAt: Date;
  paidAt: Date | null;
  paymentDueAt: Date | null;
  approvedAt: Date | null;
  depositPaidAt: Date | null;
  payments: (Omit<AdminOrderView["payments"][number], "paidAt"> & {
    paidAt: Date | null;
  })[];
};

const iso = (date: Date | null) => date?.toISOString() ?? null;

/** Даты — строками, чтобы передать заказ в клиентский компонент. */
export function toOrderView(order: AdminOrderData): AdminOrderView {
  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    paidAt: iso(order.paidAt),
    paymentDueAt: iso(order.paymentDueAt),
    approvedAt: iso(order.approvedAt),
    depositPaidAt: iso(order.depositPaidAt),
    payments: order.payments.map((payment) => ({
      ...payment,
      paidAt: iso(payment.paidAt),
    })),
  };
}

export const STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачен",
  canceled: "Отменён",
  refunded: "Возврат",
  ozon_order_failed: "Ошибка Ozon",
  fulfilling: "Собирается",
  shipped: "Отправлен",
  delivered: "Доставлен",
  requested: "Новая заявка",
  awaiting_deposit: "Ждёт предоплату",
  in_production: "Изготавливается",
  awaiting_balance: "Ждёт доплату",
  ready_to_ship: "Оплачен, к отправке",
  declined: "Отклонена",
};

/** Статусы оплаченного заказа под заказ, между которыми мастер переключает вручную. */
export const MANUAL_STATUSES = [
  "ready_to_ship",
  "shipped",
  "delivered",
] as const;

/** Заказам в этих статусах нужно действие мастера. */
export const NEEDS_ATTENTION = new Set([
  "requested",
  "in_production",
  "ready_to_ship",
  "ozon_order_failed",
]);

/** Оплачивает покупатель на странице заказа — ссылку мастер отправляет в мессенджер. */
export const orderPageUrl = (id: string) => `https://stariva.ru/order/${id}`;

export const KIND_LABELS: Record<AdminOrderView["kind"], string> = {
  stock: "Готовое",
  made_to_order: "Под заказ",
};

export function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ozon_order_failed") return "destructive";
  if (NEEDS_ATTENTION.has(status)) return "default";
  if (
    status === "pending" ||
    status === "canceled" ||
    status === "refunded" ||
    status === "declined"
  ) {
    return "outline";
  }
  return "secondary";
}

export const rubles = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export const dateTime = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Номер заказа для разговора с покупателем и поиска в уведомлениях. */
export const shortId = (id: string) => id.slice(0, 8);
