import type { CampaignAttribution, VisitorInfo } from "@stariva/db/schema";

/** Заказ в том виде, в каком его отдаёт `admin.orders.*` (даты уже строками). */
export interface AdminOrderView {
  id: string;
  number: number;
  kind: "stock" | "made_to_order";
  status: string;
  userId: string | null;
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
  /** Заявка с сайта, по которой мастер выставила счёт из админки. */
  requestNumber: number | null;
  deliveryMethod: "pickup" | "courier" | "manual";
  deliveryPointId: string | null;
  deliveryAddress: {
    address: string | null;
    title: string | null;
    locality: string | null;
    coordinates: { lat: number; lng: number } | null;
  };
  ozonDelivery: {
    type: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  } | null;
  deliveryNote: string | null;
  masterNotes: string | null;
  trackingNumber: string | null;
  paymentId: string | null;
  ozonOrderId: string | null;
  ozonPostingNumbers: string[];
  ozonShipmentStatus: "pending" | "creating" | "failed" | "created";
  staffNotifiedAt: string | null;
  createdAt: string;
  paidAt: string | null;
  attribution: CampaignAttribution | null;
  visitor: VisitorInfo | null;
  items: {
    id: string;
    productSlug: string;
    productId: string | null;
    image: string | null;
    ozonSku: number | null;
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
    status: "pending" | "succeeded" | "canceled";
    amount: number;
    yookassaPaymentId: string | null;
    createdAt: string;
    paidAt: string | null;
  }[];
  /** Сколько чеков привязано; есть только в списке заказов. */
  receiptCount?: number;
  /** Сколько чеков положено по числу оплат (отменённым и возвращённым — 0). */
  receiptsExpected?: number;
  /** Привязанные чеки, которые не отправлены покупателю. */
  receiptsUnsent?: number;
}

/** Чеков меньше, чем оплат: нет чека на предоплату, доплату или на весь заказ. */
export function needsReceipt(order: AdminOrderView): boolean {
  return (order.receiptCount ?? 0) < (order.receiptsExpected ?? 0);
}

type DateFields =
  | "createdAt"
  | "paidAt"
  | "paymentDueAt"
  | "approvedAt"
  | "depositPaidAt"
  | "staffNotifiedAt";

type PaymentView = AdminOrderView["payments"][number];

/** Заказ, как его возвращает API: даты ещё объекты Date. */
export type AdminOrderData = Omit<AdminOrderView, DateFields | "payments"> & {
  createdAt: Date;
  paidAt: Date | null;
  paymentDueAt: Date | null;
  approvedAt: Date | null;
  depositPaidAt: Date | null;
  staffNotifiedAt: Date | null;
  payments: (Omit<PaymentView, "createdAt" | "paidAt"> & {
    createdAt: Date;
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
    staffNotifiedAt: iso(order.staffNotifiedAt),
    payments: order.payments.map((payment) => ({
      ...payment,
      createdAt: payment.createdAt.toISOString(),
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

/** Статусы каждого вида заказа в порядке жизни заказа — как на сервере. */
export const STATUSES_BY_KIND: Record<AdminOrderView["kind"], string[]> = {
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
};

/** В них покупатель платит — вручную не ставятся, только оформлением и кнопками этапов. */
export const PAYMENT_STATUSES = new Set([
  "pending",
  "awaiting_deposit",
  "awaiting_balance",
]);

/** Заказам в этих статусах нужно действие мастера. */
export const NEEDS_ATTENTION = new Set([
  "requested",
  "in_production",
  "ready_to_ship",
  "ozon_order_failed",
]);

/**
 * Удалить без оговорок можно заявку, отклонённый или отменённый заказ без
 * оплат и открытых ссылок на оплату. Остальные — только с подтверждением:
 * сервер проверит то же самое и без `force` откажет.
 */
export function isSafeToDelete(order: AdminOrderView) {
  return (
    ["requested", "declined", "canceled"].includes(order.status) &&
    !order.paidAt &&
    !order.depositPaidAt &&
    order.payments.every((payment) => payment.status === "canceled")
  );
}

/** Оплачивает покупатель на странице заказа — ссылку мастер отправляет в мессенджер. */
export const orderPageUrl = (id: string) => `https://stariva.ru/order/${id}`;

export const DELIVERY_METHOD_LABELS: Record<
  AdminOrderView["deliveryMethod"],
  string
> = {
  pickup: "Пункт выдачи Ozon",
  courier: "Курьер Ozon",
  manual: "Согласует мастер",
};

/** Вид доставки из ответа Ozon при оформлении. */
export const OZON_DELIVERY_TYPE_LABELS: Record<string, string> = {
  PVZ: "пункт выдачи",
  POSTAMAT: "постамат",
  COURIER: "курьер",
};

export const SHIPMENT_STATUS_LABELS: Record<
  AdminOrderView["ozonShipmentStatus"],
  string
> = {
  pending: "ещё не создан",
  creating: "создаётся",
  failed: "не удалось создать",
  created: "создан",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentView["status"], string> = {
  pending: "ссылка открыта",
  succeeded: "оплачено",
  canceled: "не оплачено",
};

/** Страница товара на сайте: короткий адрес сам переведёт в нужную категорию. */
export const productSiteUrl = (slug: string) =>
  `https://stariva.ru/catalog/product/${slug}`;

export const KIND_LABELS: Record<AdminOrderView["kind"], string> = {
  stock: "Готовое",
  made_to_order: "Под заказ",
};

/**
 * Тон плашки статуса для `Badge` из "@stariva/ui/reui": жёлтый — ждёт мастера,
 * фиолетовый — изготавливается, в пути или ждёт покупателя, зелёный — деньги получены.
 */
export function statusVariant(
  status: string,
):
  | "warning-light"
  | "info-light"
  | "success-light"
  | "destructive-light"
  | "outline" {
  if (status === "ozon_order_failed") return "destructive-light";
  if (status === "in_production") return "info-light";
  if (NEEDS_ATTENTION.has(status)) return "warning-light";
  if (status === "paid" || status === "delivered") return "success-light";
  if (
    status === "pending" ||
    status === "canceled" ||
    status === "refunded" ||
    status === "declined"
  ) {
    return "outline";
  }
  return "info-light";
}

export const rubles = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

// Сервер админки живёт в UTC, а читает её Москва: пояс задаём явно
export const dateTime = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

/** С секундами: события корзины идут с разницей в секунды. */
export const dateTimeSeconds = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Europe/Moscow",
});
