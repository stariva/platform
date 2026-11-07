import type { OrderCostCategory } from "@stariva/db/schema";

import {
  type Expense,
  moscowDay,
  moscowNoon,
  type Period,
  within,
} from "./model";
import { firstPayment, paidSum, toCollect, type WorkOrder } from "./work";

/**
 * Сколько денег остаётся с заказа. Материалы, упаковку и прочее мастер вносит
 * сама (order_costs), эквайринг, налог и доставка считаются из оплат. Работа
 * мастера в затраты не входит: считаем только потраченные деньги.
 *
 * Выручка периода — по дням оплат, затраты — по своим дням. Так цифры сходятся
 * с «Аналитикой», а предоплата и материалы попадают в месяц, когда прошли.
 */

/** Комиссия площадки живёт в поле заказа вне сайта, остальное — строками. */
export type CostCategory = OrderCostCategory | "fee";

export const COST_CATEGORIES = [
  "materials",
  "packaging",
  "shipping",
  "fee",
  "acquiring",
  "tax",
  "other",
] as const satisfies readonly CostCategory[];

/** Ставки в сотых долях процента: 350 = 3,5%. */
export interface FinanceRates {
  acquiring: number;
  tax: number;
}

export const DEFAULT_RATES: FinanceRates = { acquiring: 350, tax: 400 };

export interface CostEntry {
  category: CostCategory;
  at: Date;
  amount: number;
  // Строка, внесённая вручную; null — посчитано само
  lineId: string | null;
}

type CostedOrder = Pick<
  WorkOrder,
  "kind" | "amount" | "payments" | "fee" | "delivery" | "costLines"
>;

const percentOf = (amount: number, rate: number) =>
  Math.round((amount * rate) / 10_000);

const sumOf = (rows: { amount: number }[]) =>
  rows.reduce((sum, row) => sum + row.amount, 0);

/**
 * Все затраты заказа. Внесённая вручную строка заменяет посчитанную сумму той
 * же категории: так можно указать настоящую цену доставки или налог 6% с
 * юрлица. Без оплат сами ничего не считаются: у отменённого остаётся только
 * то, что мастер успела потратить.
 */
export function costEntries(
  order: CostedOrder,
  rates: FinanceRates,
  payments = order.payments,
): CostEntry[] {
  const entries: CostEntry[] = order.costLines.map((line) => ({
    category: line.category,
    at: moscowNoon(line.spentOn),
    amount: line.amount,
    lineId: line.id,
  }));
  if (payments.length === 0) return entries;

  const manual = new Set(order.costLines.map((line) => line.category));
  const auto = (category: CostCategory, at: Date, amount: number) => {
    if (amount > 0) entries.push({ category, at, amount, lineId: null });
  };
  const times = payments.map((payment) => payment.at.getTime());

  auto("fee", new Date(Math.min(...times)), order.fee);
  for (const payment of payments) {
    if (order.kind !== "manual" && !manual.has("acquiring")) {
      auto("acquiring", payment.at, percentOf(payment.amount, rates.acquiring));
    }
    if (!manual.has("tax")) {
      auto("tax", payment.at, percentOf(payment.amount, rates.tax));
    }
  }
  // Доставку покупатель платит последней оплатой, и эти деньги уходят Ozon
  if (!manual.has("shipping") && sumOf(payments) >= order.amount) {
    auto("shipping", new Date(Math.max(...times)), order.delivery);
  }
  return entries;
}

/**
 * Изделие оплачено, а материалы не внесены: прибыль такого заказа завышена.
 * Мастер-класс материалов не требует. Сумма 0 тоже считается внесённой.
 */
export const needsMaterials = (
  order: Pick<WorkOrder, "kind" | "payments" | "costLines">,
) =>
  (order.kind === "product" || order.kind === "manual") &&
  order.payments.length > 0 &&
  !order.costLines.some((line) => line.category === "materials");

/**
 * Экономика одного заказа целиком. У заказа в работе остаток считается
 * полученным: видно, сколько останется, когда клиент доплатит.
 */
export function orderEconomics(
  order: WorkOrder,
  rates: FinanceRates,
  now: Date,
) {
  const rest = toCollect(order);
  const payments =
    rest > 0 ? [...order.payments, { at: now, amount: rest }] : order.payments;
  const entries = costEntries(order, rates, payments);
  const revenue = sumOf(payments);
  const costs = sumOf(entries);
  return {
    revenue,
    costs,
    profit: revenue - costs,
    expected: rest > 0,
    missingMaterials: needsMaterials(order),
    entries,
  };
}

export interface PeriodEconomics {
  // Деньги, поступившие за период
  revenue: number;
  costs: Record<CostCategory, number>;
  totalCosts: number;
  // Заказы, по которым первые деньги пришли за период
  paidOrders: number;
  // Из них без внесённых материалов, и сколько за них получено за период
  missingOrders: number;
  missingRevenue: number;
}

const emptyEconomics = (): PeriodEconomics => ({
  revenue: 0,
  costs: {
    materials: 0,
    packaging: 0,
    shipping: 0,
    fee: 0,
    acquiring: 0,
    tax: 0,
    other: 0,
  },
  totalCosts: 0,
  paidOrders: 0,
  missingOrders: 0,
  missingRevenue: 0,
});

function addOrder(
  row: PeriodEconomics,
  order: WorkOrder,
  rates: FinanceRates,
  period: Period,
) {
  const received = sumOf(
    order.payments.filter((payment) => within(payment.at, period)),
  );
  row.revenue += received;
  for (const entry of costEntries(order, rates)) {
    if (!within(entry.at, period)) continue;
    row.costs[entry.category] += entry.amount;
    row.totalCosts += entry.amount;
  }
  const first = firstPayment(order);
  if (first && within(first, period)) {
    row.paidOrders += 1;
    if (needsMaterials(order)) {
      row.missingOrders += 1;
      row.missingRevenue += received;
    }
  }
}

export function periodEconomics(
  orders: WorkOrder[],
  rates: FinanceRates,
  period: Period,
): PeriodEconomics {
  const row = emptyEconomics();
  for (const order of orders) addOrder(row, order, rates, period);
  return row;
}

/** Экономика периода в разрезе ключа: площадки, вида заказа и т. п. */
export function economicsBy<K extends string>(
  orders: WorkOrder[],
  rates: FinanceRates,
  period: Period,
  key: (order: WorkOrder) => K,
): Map<K, PeriodEconomics> {
  const rows = new Map<K, PeriodEconomics>();
  for (const order of orders) {
    const k = key(order);
    let row = rows.get(k);
    if (!row) {
      row = emptyEconomics();
      rows.set(k, row);
    }
    addOrder(row, order, rates, period);
  }
  return rows;
}

/** Выручка − затраты заказов − реклама − постоянные расходы = чистая прибыль. */
export function profitReport(
  orders: WorkOrder[],
  rates: FinanceRates,
  adExpenses: Pick<Expense, "spentOn" | "amount">[],
  overheads: { spentOn: string; amount: number }[],
  period: Period,
) {
  const inPeriod = (row: { spentOn: string }) =>
    within(moscowDay(row.spentOn), period);
  const economics = periodEconomics(orders, rates, period);
  const margin = economics.revenue - economics.totalCosts;
  const adSpend = sumOf(adExpenses.filter(inPeriod));
  const overhead = sumOf(overheads.filter(inPeriod));
  return {
    ...economics,
    margin,
    adSpend,
    overhead,
    net: margin - adSpend - overhead,
  };
}

/**
 * Что выгоднее продавать: изделия с сайта и мастер-классы, оплаченные впервые
 * за период. Затраты заказа делятся между позициями по их доле в сумме.
 * Прибыль — только по полностью оплаченным заказам с внесёнными материалами,
 * остальные её бы исказили.
 */
export function itemMargins(
  orders: WorkOrder[],
  rates: FinanceRates,
  period: Period,
) {
  const rows = new Map<
    string,
    {
      name: string;
      orders: number;
      quantity: number;
      revenue: number;
      countedOrders: number;
      countedRevenue: number;
      countedCosts: number;
    }
  >();
  for (const order of orders) {
    const first = firstPayment(order);
    if (!first || !within(first, period)) continue;
    let items = order.items;
    if (order.kind === "workshop") {
      items = [{ name: order.title, quantity: 1, price: order.amount }];
    }
    const whole = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    if (whole === 0) continue;

    const paid = paidSum(order);
    const counted = !needsMaterials(order) && paid >= order.amount;
    const costs = sumOf(costEntries(order, rates));
    // Два варианта одного изделия в заказе — это один заказ, а не два
    const seen = new Set<string>();
    for (const item of items) {
      const share = (item.price * item.quantity) / whole;
      const row = rows.get(item.name) ?? {
        name: item.name,
        orders: 0,
        quantity: 0,
        revenue: 0,
        countedOrders: 0,
        countedRevenue: 0,
        countedCosts: 0,
      };
      if (!seen.has(item.name)) {
        seen.add(item.name);
        row.orders += 1;
        if (counted) row.countedOrders += 1;
      }
      row.quantity += item.quantity;
      row.revenue += paid * share;
      if (counted) {
        row.countedRevenue += paid * share;
        row.countedCosts += costs * share;
      }
      rows.set(item.name, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.revenue - a.revenue);
}
