import type { CrmOrderStatus, OrderChannel } from "@stariva/db/schema";

import { type Client, moscowDay, type Period, toMoscowDay } from "./model";

/**
 * Все заказы в одной ленте: с сайта (готовые и под заказ), записи на
 * мастер-классы, заказы с площадок и из мессенджеров, свежие заявки. У каждого
 * источника свои статусы — здесь они сводятся к общим этапам, чтобы видеть,
 * что сейчас в работе и сколько денег ещё придёт.
 */

/** Общий этап заказа из любого источника. */
export type Stage =
  | "new"
  | "awaiting_payment"
  | "in_work"
  | "ready"
  | "shipped"
  | "done"
  | "canceled"
  // Корзина сайта без оплаты: покупатель ушёл со страницы оплаты
  | "unpaid";

/** Этапы, на которых заказ ещё в работе, — в порядке жизни заказа. */
export const ACTIVE_STAGES: Stage[] = [
  "new",
  "awaiting_payment",
  "in_work",
  "ready",
  "shipped",
];

export const isActive = (stage: Stage) => ACTIVE_STAGES.includes(stage);

/** Где оформлен заказ: сайт или площадка заказа вне сайта. */
export type WorkChannel = "site" | OrderChannel;

/** Что за заказ: готовое и под заказ с сайта, мастер-класс, вне сайта, заявка. */
export type WorkType =
  | "stock"
  | "made_to_order"
  | "workshop"
  | "external"
  | "request";

const PRODUCT_STAGES: Record<string, Stage> = {
  requested: "new",
  pending: "unpaid",
  awaiting_deposit: "awaiting_payment",
  awaiting_balance: "awaiting_payment",
  paid: "in_work",
  fulfilling: "in_work",
  ozon_order_failed: "in_work",
  in_production: "in_work",
  ready_to_ship: "ready",
  shipped: "shipped",
  delivered: "done",
  canceled: "canceled",
  declined: "canceled",
  refunded: "canceled",
};

const WORKSHOP_STAGES: Record<string, Stage> = {
  pending: "unpaid",
  paid: "done",
  canceled: "canceled",
  refunded: "canceled",
};

const MANUAL_STAGES: Record<CrmOrderStatus, Stage> = {
  new: "new",
  awaiting_payment: "awaiting_payment",
  in_production: "in_work",
  ready: "ready",
  shipped: "shipped",
  done: "done",
  canceled: "canceled",
};

/** Этап заказа с сайта; незнакомый статус считается рабочим, чтобы не потерялся. */
export const productStage = (status: string): Stage =>
  PRODUCT_STAGES[status] ?? "in_work";

export const workshopStage = (status: string): Stage =>
  WORKSHOP_STAGES[status] ?? "unpaid";

export const manualStage = (status: CrmOrderStatus): Stage =>
  MANUAL_STAGES[status] ?? "in_work";

/** Заказ в общей ленте. Суммы в копейках. */
export interface WorkOrder {
  kind: "product" | "workshop" | "manual" | "request";
  id: string;
  // Номер для людей: «№1042», номер на площадке или null
  number: string | null;
  type: WorkType;
  channel: WorkChannel;
  title: string;
  clientName: string;
  phone: string | null;
  email: string | null;
  // Адрес карточки клиента в CRM, если клиент известен
  clientKey: string | null;
  stage: Stage;
  // Исходный статус источника
  status: string;
  amount: number;
  // Поступившие деньги; у возвращённых и отменённых — пусто
  payments: { at: Date; amount: number }[];
  fee: number;
  createdAt: Date;
  // Срок, обещанный клиенту, «2026-10-20»
  dueOn: string | null;
  // До какого момента ждём оплату по ссылке с сайта
  paymentDueAt: Date | null;
  // С какого момента заказ на текущем этапе, если известно
  stageSince: Date | null;
  closedAt: Date | null;
  campaignId: string | null;
  // Позиции заказа с сайта — для «что продаётся лучше»
  items: { name: string; quantity: number; price: number }[];
}

export const paidSum = (order: Pick<WorkOrder, "payments">) =>
  order.payments.reduce((sum, payment) => sum + payment.amount, 0);

/** Сколько ещё должен заплатить клиент по заказу в работе. */
export function toCollect(order: WorkOrder): number {
  if (!isActive(order.stage) || order.kind === "request") return 0;
  return Math.max(0, order.amount - paidSum(order));
}

/**
 * Просрочен ли заказ на день `today` (по Москве): прошёл срок, обещанный
 * клиенту, а заказ ещё не отправлен, или истекла ссылка на оплату.
 */
export function isOverdue(order: WorkOrder, today: string, now: Date) {
  if (!isActive(order.stage)) return false;
  if (order.dueOn && order.dueOn < today && order.stage !== "shipped") {
    return true;
  }
  return (
    order.stage === "awaiting_payment" &&
    order.paymentDueAt !== null &&
    order.paymentDueAt < now
  );
}

/** Полных дней с момента `since` до `now`. */
export const daysSince = (since: Date, now: Date) =>
  Math.max(0, Math.floor((now.getTime() - since.getTime()) / 86_400_000));

/** Адреса карточек клиентов для заказов: по телефону, почте или id карточки. */
export function clientKeys(clients: Client[]) {
  const byPhone = new Map<string, string>();
  const byEmail = new Map<string, string>();
  for (const client of clients) {
    for (const phone of client.phones) byPhone.set(phone, client.key);
    for (const email of client.emails) byEmail.set(email, client.key);
  }
  return (phone: string | null, email: string | null) =>
    (phone && byPhone.get(phone)) || (email && byEmail.get(email)) || null;
}

const within = (at: Date, { from, to }: Period) =>
  (!from || at >= from) && (!to || at < to);

const firstPayment = (order: WorkOrder) =>
  order.payments.reduce<Date | null>(
    (min, payment) => (!min || payment.at < min ? payment.at : min),
    null,
  );

/** Заказ оформлен по-настоящему: не заявка и не брошенная корзина. */
const isPlaced = (order: WorkOrder) =>
  order.kind !== "request" && order.stage !== "unpaid";

export interface SalesTotals {
  // Оформлено за период (без заявок и брошенных корзин)
  placed: number;
  // Из них отменено
  canceled: number;
  // Заказы, по которым первые деньги пришли за период
  paidOrders: number;
  // Сумма этих заказов — для среднего чека
  paidOrdersAmount: number;
  // Деньги, поступившие за период
  revenue: number;
  // Комиссии площадок по заказам, оплаченным впервые за период
  fees: number;
}

const emptyTotals = (): SalesTotals => ({
  placed: 0,
  canceled: 0,
  paidOrders: 0,
  paidOrdersAmount: 0,
  revenue: 0,
  fees: 0,
});

/** Добавляет заказ к итогам периода. */
function addTo(totals: SalesTotals, order: WorkOrder, period: Period) {
  if (isPlaced(order) && within(order.createdAt, period)) {
    totals.placed += 1;
    if (order.stage === "canceled") totals.canceled += 1;
  }
  const first = firstPayment(order);
  if (first && within(first, period)) {
    totals.paidOrders += 1;
    totals.paidOrdersAmount += Math.max(order.amount, paidSum(order));
    totals.fees += order.fee;
  }
  for (const payment of order.payments) {
    if (within(payment.at, period)) totals.revenue += payment.amount;
  }
}

/** Итоги периода в разрезе ключа: площадки, вида заказа и т. п. */
export function totalsBy<K extends string>(
  orders: WorkOrder[],
  period: Period,
  key: (order: WorkOrder) => K,
): Map<K, SalesTotals> {
  const rows = new Map<K, SalesTotals>();
  for (const order of orders) {
    const k = key(order);
    let entry = rows.get(k);
    if (!entry) {
      entry = emptyTotals();
      rows.set(k, entry);
    }
    addTo(entry, order, period);
  }
  return rows;
}

export function totals(orders: WorkOrder[], period: Period): SalesTotals {
  const total = emptyTotals();
  for (const order of orders) addTo(total, order, period);
  return total;
}

/** Что продаётся лучше: позиции заказов с сайта, оплаченных впервые за период. */
export function topItems(orders: WorkOrder[], period: Period, limit = 10) {
  const items = new Map<
    string,
    { name: string; quantity: number; revenue: number; orders: number }
  >();
  for (const order of orders) {
    const first = firstPayment(order);
    if (!first || !within(first, period)) continue;
    for (const item of order.items) {
      const entry = items.get(item.name) ?? {
        name: item.name,
        quantity: 0,
        revenue: 0,
        orders: 0,
      };
      entry.quantity += item.quantity;
      entry.revenue += item.price * item.quantity;
      entry.orders += 1;
      items.set(item.name, entry);
    }
  }
  return [...items.values()]
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
    .slice(0, limit);
}

/**
 * Выручка за период от новых и вернувшихся покупателей: вернувшийся —
 * тот, кто впервые заплатил до начала периода.
 */
export function newVsRepeat(clients: Client[], period: Period) {
  const result = { newRevenue: 0, repeatRevenue: 0, newBuyers: 0, repeat: 0 };
  for (const client of clients) {
    const returning =
      client.firstPaidAt !== null &&
      period.from !== null &&
      client.firstPaidAt < period.from;
    let paidInPeriod = false;
    for (const deal of client.deals) {
      for (const payment of deal.payments) {
        if (!within(payment.at, period)) continue;
        paidInPeriod = true;
        if (returning) result.repeatRevenue += payment.amount;
        else result.newRevenue += payment.amount;
      }
    }
    if (paidInPeriod) {
      if (returning) result.repeat += 1;
      else result.newBuyers += 1;
    }
  }
  return result;
}

/** Первый день месяца, отстоящего от месяца `day` на `shift`. */
export function monthStart(day: string, shift: number): string {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7)) - 1;
  return new Date(Date.UTC(year, month + shift, 1)).toISOString().slice(0, 10);
}

/** Последние `count` месяцев по Москве, старые первыми, с границами. */
export function lastMonths(now: Date, count: number) {
  const today = toMoscowDay(now);
  return Array.from({ length: count }, (_, index) => {
    const start = monthStart(today, index - count + 1);
    return {
      month: start.slice(0, 7),
      period: {
        from: moscowDay(start),
        to: moscowDay(monthStart(start, 1)),
      } satisfies Period,
    };
  });
}
