/**
 * Как покупатель видит заказ: подписи статусов, этапы и подсказки «что дальше».
 * Общие для личного кабинета и гостевой страницы заказа.
 */

/** Мастер-класс, готовое изделие со склада или изделие под заказ. */
export type OrderKind = "workshop" | "stock" | "made_to_order";

/**
 * Цвет статуса: attention — ждём действия покупателя (оплатить),
 * progress — заказ в работе, success — завершён, muted — отменён.
 */
export type StatusTone = "attention" | "progress" | "success" | "muted";

export const productOrderStatusLabels: Record<string, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачен",
  canceled: "Отменён",
  refunded: "Возврат",
  ozon_order_failed: "Обрабатывается вручную",
  fulfilling: "Собирается",
  shipped: "В пути",
  delivered: "Доставлен",
  requested: "Заявка отправлена",
  awaiting_deposit: "Ждёт предоплату",
  in_production: "Изготавливается",
  awaiting_balance: "Готово · ждёт доплату",
  ready_to_ship: "Оплачен · готовим отправку",
  declined: "Заявка отклонена",
};

const workshopOrderStatusLabels: Record<string, string> = {
  pending: "Ожидает оплаты",
  paid: "Доступ открыт",
  canceled: "Отменён",
  refunded: "Возврат",
};

/** Что дальше, для заказа под заказ: по статусу. */
export const madeToOrderHints: Record<string, string> = {
  requested:
    "Оплачивать пока ничего не нужно. Мастер свяжется с вами, чтобы уточнить мерки, цвет, цену и доставку. Мерки и пожелания можно указать ниже.",
  awaiting_deposit:
    "Мастер согласовал заказ. Внесите предоплату 50% — и мастер начнёт плести.",
  in_production:
    "Предоплата получена — мастер плетёт ваше изделие. Когда оно будет готово, здесь появится доплата.",
  awaiting_balance:
    "Изделие готово! Внесите доплату — и мастер отправит заказ.",
  ready_to_ship: "Заказ оплачен полностью. Мастер готовит отправку.",
  shipped: "Заказ отправлен.",
  delivered: "Заказ получен. Спасибо!",
  canceled: "Заказ отменён.",
};

/** Что дальше, для готового изделия: по статусу. */
export const stockOrderHints: Record<string, string> = {
  pending:
    "Заказ ждёт оплаты. Если вы закрыли страницу оплаты, оформите заказ заново из корзины.",
  paid: "Оплата получена. Передаём заказ в Ozon Доставку.",
  ozon_order_failed:
    "Оплата получена. Мастер оформит доставку вручную и напишет вам.",
  fulfilling: "Заказ собирается и скоро уйдёт в доставку.",
  shipped: "Заказ в пути.",
  delivered: "Заказ получен. Спасибо!",
  refunded: "Деньги за заказ возвращены.",
};

export const postingStatusLabels: Record<string, string> = {
  awaiting_packaging: "Ожидает сборки",
  awaiting_deliver: "Ожидает отгрузки",
  delivering: "В пути",
  delivered: "Доставлено",
  cancelled: "Отменено",
  unknown: "Статус уточняется",
};

export function orderStatusLabel(kind: OrderKind, status: string): string {
  const labels =
    kind === "workshop" ? workshopOrderStatusLabels : productOrderStatusLabels;
  return labels[status] ?? status;
}

const CLOSED_STATUSES = new Set(["canceled", "refunded", "declined"]);

const AWAITING_PAYMENT_STATUSES = new Set([
  "pending",
  "awaiting_deposit",
  "awaiting_balance",
]);

export function orderStatusTone(kind: OrderKind, status: string): StatusTone {
  if (CLOSED_STATUSES.has(status)) return "muted";
  if (AWAITING_PAYMENT_STATUSES.has(status)) return "attention";
  if (status === "delivered" || (kind === "workshop" && status === "paid")) {
    return "success";
  }
  return "progress";
}

/** Текущие заказы ещё в работе; завершённые — получены, открыты или отменены. */
export function isOrderActive(kind: OrderKind, status: string): boolean {
  const tone = orderStatusTone(kind, status);
  return tone === "attention" || tone === "progress";
}

const STOCK_STEPS = ["Оформлен", "Оплачен", "Собирается", "В пути", "Получен"];

const STOCK_STEP_BY_STATUS: Record<string, number> = {
  pending: 0,
  paid: 1,
  ozon_order_failed: 1,
  fulfilling: 2,
  shipped: 3,
  delivered: 4,
};

const MADE_TO_ORDER_STEPS = [
  "Заявка",
  "Согласован",
  "В работе",
  "Готов",
  "В пути",
  "Получен",
];

const MADE_TO_ORDER_STEP_BY_STATUS: Record<string, number> = {
  requested: 0,
  awaiting_deposit: 1,
  in_production: 2,
  awaiting_balance: 3,
  ready_to_ship: 3,
  shipped: 4,
  delivered: 5,
};

export interface OrderProgress {
  steps: string[];
  /** Индекс последнего пройденного этапа. */
  reached: number;
}

/**
 * Этапы заказа для шкалы прогресса. null — у заказа нет этапов: мастер-класс
 * открывается сразу после оплаты, а отменённому заказу шкала ни к чему.
 */
export function orderProgress(
  kind: OrderKind,
  status: string,
): OrderProgress | null {
  if (kind === "workshop") return null;
  const [steps, byStatus] =
    kind === "stock"
      ? [STOCK_STEPS, STOCK_STEP_BY_STATUS]
      : [MADE_TO_ORDER_STEPS, MADE_TO_ORDER_STEP_BY_STATUS];
  const reached = byStatus[status];
  return reached === undefined ? null : { steps, reached };
}
