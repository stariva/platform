/** Заказ в том виде, в каком его отдаёт `admin.orders.*` (даты уже строками). */
export interface AdminOrderView {
  id: string;
  kind: "stock" | "made_to_order";
  status: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  amountTotal: number;
  amountDelivery: number;
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
  awaiting_details: "Уточнить детали",
  in_production: "Изготавливается",
  ready_to_ship: "Готов к отправке",
};

/** Статусы, в которые мастер переводит оплаченный заказ под заказ, — по порядку работы. */
export const MADE_TO_ORDER_STATUSES = [
  "awaiting_details",
  "in_production",
  "ready_to_ship",
  "shipped",
  "delivered",
] as const;

/** Заказам в этих статусах нужно действие мастера. */
export const NEEDS_ATTENTION = new Set([
  "awaiting_details",
  "ozon_order_failed",
]);

export const KIND_LABELS: Record<AdminOrderView["kind"], string> = {
  stock: "Готовое",
  made_to_order: "Под заказ",
};

export function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ozon_order_failed") return "destructive";
  if (NEEDS_ATTENTION.has(status)) return "default";
  if (status === "pending" || status === "canceled" || status === "refunded") {
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
