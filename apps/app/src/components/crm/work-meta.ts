import type { CrmOrderStatus, OrderChannel } from "@stariva/db/schema";
import { STATUS_LABELS } from "~/components/orders/order-meta";
import { WORKSHOP_ORDER_STATUS_LABELS } from "~/components/workshops/workshop-orders-table";

/** Общий этап заказа из любого источника — как в `admin.crm.orders`. */
export type Stage =
  | "new"
  | "awaiting_payment"
  | "in_work"
  | "ready"
  | "shipped"
  | "done"
  | "canceled"
  | "unpaid";

export type WorkChannel = "site" | OrderChannel;

export type WorkType =
  | "stock"
  | "made_to_order"
  | "workshop"
  | "external"
  | "request";

/** Этапы в работе — колонки доски, в порядке жизни заказа. */
export const ACTIVE_STAGES: Stage[] = [
  "new",
  "awaiting_payment",
  "in_work",
  "ready",
  "shipped",
];

export const STAGE_LABELS: Record<Stage, string> = {
  new: "Новые",
  awaiting_payment: "Ждут оплаты",
  in_work: "В работе",
  ready: "Готовы к отправке",
  shipped: "В пути",
  done: "Выполнены",
  canceled: "Отменены",
  unpaid: "Не оплачены",
};

/** Что делать с заказами на этапе — подсказка под заголовком колонки. */
export const STAGE_HINTS: Partial<Record<Stage, string>> = {
  new: "Связаться, согласовать цену и срок",
  awaiting_payment: "Выставлена оплата, ждём деньги",
  in_work: "Плетётся или собирается",
  ready: "Упаковать и отправить",
  shipped: "Проверить, что дошло",
};

export const CHANNEL_LABELS: Record<WorkChannel, string> = {
  site: "Сайт",
  avito: "Авито",
  ozon: "Ozon",
  wildberries: "Wildberries",
  yandex_market: "Яндекс Маркет",
  yarmarka: "Ярмарка Мастеров",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  vk: "ВКонтакте",
  offline: "Лично / выставка",
  other: "Другое",
};

/** Площадки для заказа вне сайта — в порядке выбора в форме. */
export const ORDER_CHANNELS = (
  Object.keys(CHANNEL_LABELS) as WorkChannel[]
).filter((channel): channel is OrderChannel => channel !== "site");

export const TYPE_LABELS: Record<WorkType, string> = {
  stock: "Готовое",
  made_to_order: "Под заказ",
  workshop: "Мастер-класс",
  external: "Вне сайта",
  request: "Заявка",
};

export const CRM_STATUS_LABELS: Record<CrmOrderStatus, string> = {
  new: "Новый",
  awaiting_payment: "Ждёт оплату",
  in_production: "Изготавливается",
  ready: "Готов к отправке",
  shipped: "Отправлен",
  done: "Выполнен",
  canceled: "Отменён",
};

/** Этапы заказа вне сайта — в порядке жизни заказа. */
export const CRM_STATUSES = Object.keys(CRM_STATUS_LABELS) as CrmOrderStatus[];

/** Подпись исходного статуса заказа, записи, заказа вне сайта или заявки. */
export function statusLabel(order: {
  kind: "product" | "workshop" | "manual" | "request";
  status: string;
}): string {
  switch (order.kind) {
    case "product":
      return STATUS_LABELS[order.status] ?? order.status;
    case "workshop":
      return (
        WORKSHOP_ORDER_STATUS_LABELS[
          order.status as keyof typeof WORKSHOP_ORDER_STATUS_LABELS
        ] ?? order.status
      );
    case "manual":
      return CRM_STATUS_LABELS[order.status as CrmOrderStatus] ?? order.status;
    default:
      return "Заявка без заказа";
  }
}

/** «3 дня», «1 день», «12 дней». */
export function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const days = (count: number) =>
  `${count} ${plural(count, "день", "дня", "дней")}`;

/** Рубли: пробелы между тысячами, запятая или точка перед копейками; пусто — 0. */
export function parseRubles(value: string): number | null {
  const normalized = value.trim().replace(/[\u00a0\u202f]/g, " ");
  if (!normalized) return 0;
  if (!/^(?:\d+|\d{1,3}(?: \d{3})+)(?:[.,]\d{1,2})?$/.test(normalized)) {
    return null;
  }
  const amount = Number(normalized.replace(/ /g, "").replace(",", "."));
  return Number.isFinite(amount) ? amount : null;
}
