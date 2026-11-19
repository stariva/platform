import { expect, test } from "bun:test";
import {
  costEntries,
  economicsBy,
  itemMargins,
  needsMaterials,
  orderEconomics,
  periodEconomics,
  profitReport,
} from "./economics";
import { moscowDay } from "./model";
import type { CostLine, WorkOrder } from "./work";

const RATES = { acquiring: 350, tax: 400 };

const october = { from: moscowDay("2026-10-01"), to: moscowDay("2026-11-01") };
const november = { from: moscowDay("2026-11-01"), to: moscowDay("2026-12-01") };
const NOW = new Date("2026-11-20T09:00:00Z");

const paid = (day: string, amount: number) => ({
  at: new Date(`${day}T09:00:00Z`),
  amount,
});

const line = (
  category: CostLine["category"],
  amount: number,
  spentOn = "2026-10-10",
): CostLine => ({
  id: `${category}-${amount}`,
  category,
  spentOn,
  amount,
  note: null,
});

function order(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    kind: "product",
    id: "order",
    number: "№1",
    type: "made_to_order",
    channel: "site",
    title: "Панно",
    clientName: "Анна",
    phone: null,
    email: null,
    clientKey: null,
    stage: "done",
    status: "delivered",
    amount: 1_000_000,
    payments: [paid("2026-10-05", 1_000_000)],
    fee: 0,
    delivery: 0,
    costLines: [],
    createdAt: new Date("2026-10-05T09:00:00Z"),
    dueOn: null,
    paymentDueAt: null,
    stageSince: null,
    closedAt: null,
    campaignId: null,
    items: [],
    ...overrides,
  };
}

const byCategory = (target: WorkOrder) =>
  Object.fromEntries(
    costEntries(target, RATES).map((entry) => [entry.category, entry.amount]),
  );

test("заказ с сайта: эквайринг и налог считаются с каждой оплаты, материалы — как внесены", () => {
  const target = order({
    payments: [paid("2026-10-05", 500_000), paid("2026-10-20", 500_000)],
    costLines: [line("materials", 200_000)],
  });
  const entries = costEntries(target, RATES);
  const sum = (category: string) =>
    entries
      .filter((entry) => entry.category === category)
      .reduce((total, entry) => total + entry.amount, 0);
  expect(sum("materials")).toBe(200_000);
  expect(sum("acquiring")).toBe(35_000);
  expect(sum("tax")).toBe(40_000);
  expect(entries.filter((entry) => entry.lineId !== null)).toHaveLength(1);
});

test("заказ вне сайта: без эквайринга, но с налогом и комиссией площадки", () => {
  expect(
    byCategory(order({ kind: "manual", type: "external", fee: 50_000 })),
  ).toEqual({ fee: 50_000, tax: 40_000 });
});

test("внесённая строка заменяет посчитанную сумму той же категории", () => {
  const costs = byCategory(
    order({
      delivery: 45_000,
      costLines: [line("tax", 60_000), line("shipping", 52_000)],
    }),
  );
  expect(costs.tax).toBe(60_000);
  expect(costs.shipping).toBe(52_000);
  expect(costs.acquiring).toBe(35_000);
});

test("доставка считается, только когда заказ оплачен полностью", () => {
  const deposit = order({
    delivery: 45_000,
    payments: [paid("2026-10-05", 300_000)],
  });
  expect(byCategory(deposit).shipping).toBeUndefined();
  const full = order({
    delivery: 45_000,
    payments: [paid("2026-10-05", 300_000), paid("2026-11-02", 700_000)],
  });
  const shipping = costEntries(full, RATES).find(
    (entry) => entry.category === "shipping",
  );
  expect(shipping?.amount).toBe(45_000);
  expect(shipping?.at).toEqual(new Date("2026-11-02T09:00:00Z"));
});

test("отменённый заказ без денег теряет только потраченное", () => {
  const canceled = order({
    stage: "canceled",
    payments: [],
    delivery: 45_000,
    costLines: [line("materials", 150_000)],
  });
  expect(byCategory(canceled)).toEqual({ materials: 150_000 });
  const october_ = periodEconomics([canceled], RATES, october);
  expect(october_.revenue).toBe(0);
  expect(october_.totalCosts).toBe(150_000);
});

test("материалы нужны изделиям, но не мастер-классам; ноль считается внесённым", () => {
  expect(needsMaterials(order())).toBe(true);
  expect(needsMaterials(order({ kind: "manual" }))).toBe(true);
  expect(needsMaterials(order({ kind: "workshop" }))).toBe(false);
  expect(needsMaterials(order({ payments: [] }))).toBe(false);
  expect(needsMaterials(order({ costLines: [line("materials", 0)] }))).toBe(
    false,
  );
  expect(needsMaterials(order({ costLines: [line("packaging", 100)] }))).toBe(
    true,
  );
});

test("заказ в работе: прибыль считается так, будто клиент уже доплатил", () => {
  const result = orderEconomics(
    order({
      stage: "in_work",
      delivery: 40_000,
      payments: [paid("2026-10-05", 300_000)],
      costLines: [line("materials", 100_000)],
    }),
    RATES,
    NOW,
  );
  expect(result.expected).toBe(true);
  expect(result.revenue).toBe(1_000_000);
  // Материалы, 3,5% и 4% со всей суммы, доставка
  expect(result.costs).toBe(100_000 + 35_000 + 40_000 + 40_000);
  expect(result.profit).toBe(785_000);
});

test("закрытый заказ: прибыль по поступившим деньгам", () => {
  const result = orderEconomics(
    order({ costLines: [line("materials", 100_000)] }),
    RATES,
    NOW,
  );
  expect(result.expected).toBe(false);
  expect(result.profit).toBe(825_000);
});

test("выручка и затраты попадают в свои месяцы", () => {
  const target = order({
    payments: [paid("2026-10-05", 300_000), paid("2026-11-02", 700_000)],
    costLines: [line("materials", 100_000, "2026-10-10")],
  });
  const first = periodEconomics([target], RATES, october);
  const second = periodEconomics([target], RATES, november);
  expect(first.revenue).toBe(300_000);
  expect(first.costs.materials).toBe(100_000);
  expect(first.costs.tax).toBe(12_000);
  expect(first.paidOrders).toBe(1);
  expect(second.revenue).toBe(700_000);
  expect(second.costs.materials).toBe(0);
  expect(second.costs.tax).toBe(28_000);
  expect(second.paidOrders).toBe(0);
});

test("заказы без материалов считаются по месяцу первой оплаты", () => {
  const rows = [
    order({ id: "a" }),
    order({ id: "b", costLines: [line("materials", 0)] }),
    order({
      id: "c",
      kind: "workshop",
      amount: 99_000,
      payments: [paid("2026-10-06", 99_000)],
    }),
  ];
  const result = periodEconomics(rows, RATES, october);
  expect(result.paidOrders).toBe(3);
  expect(result.missingOrders).toBe(1);
  expect(result.missingRevenue).toBe(1_000_000);
});

test("выручка заказа без материалов считается только за выбранный период", () => {
  const target = order({
    payments: [paid("2026-10-05", 300_000), paid("2026-11-02", 700_000)],
  });
  const first = periodEconomics([target], RATES, october);
  expect(first.missingOrders).toBe(1);
  expect(first.missingRevenue).toBe(300_000);
  // Остаток пришёл позже: заказ считается в месяце первой оплаты
  expect(periodEconomics([target], RATES, november).missingOrders).toBe(0);
});

test("чистая прибыль: выручка − затраты − реклама − постоянные расходы", () => {
  const result = profitReport(
    [order({ costLines: [line("materials", 100_000)] })],
    RATES,
    [
      { spentOn: "2026-10-03", amount: 50_000 },
      { spentOn: "2026-11-03", amount: 999_999 },
    ],
    [
      { spentOn: "2026-10-31", amount: 20_000 },
      { spentOn: "2026-09-30", amount: 999_999 },
    ],
    october,
  );
  expect(result.totalCosts).toBe(175_000);
  expect(result.margin).toBe(825_000);
  expect(result.adSpend).toBe(50_000);
  expect(result.overhead).toBe(20_000);
  expect(result.net).toBe(755_000);
});

test("разбивка по ключу суммируется в общий итог", () => {
  const rows = [
    order({ id: "a", channel: "site" }),
    order({ id: "b", kind: "manual", channel: "avito", fee: 10_000 }),
  ];
  const split = economicsBy(rows, RATES, october, (row) => row.channel);
  const whole = periodEconomics(rows, RATES, october);
  expect(split.get("avito")?.costs.fee).toBe(10_000);
  expect(
    [...split.values()].reduce((sum, row) => sum + row.totalCosts, 0),
  ).toBe(whole.totalCosts);
});

test("прибыль изделий считается только по оплаченным заказам с материалами", () => {
  const items = [
    { name: "Панно", quantity: 1, price: 750_000 },
    { name: "Кашпо", quantity: 1, price: 250_000 },
  ];
  const rows = itemMargins(
    [
      order({ id: "a", items, costLines: [line("materials", 125_000)] }),
      order({ id: "b", items }),
      order({
        id: "c",
        kind: "workshop",
        title: "Ёлка",
        amount: 99_000,
        payments: [paid("2026-10-06", 99_000)],
      }),
    ],
    RATES,
    october,
  );
  const panno = rows.find((row) => row.name === "Панно");
  expect(panno?.orders).toBe(2);
  expect(panno?.revenue).toBe(1_500_000);
  expect(panno?.countedOrders).toBe(1);
  expect(panno?.countedRevenue).toBe(750_000);
  expect(panno?.countedCosts).toBe((125_000 + 35_000 + 40_000) * 0.75);
  const workshop = rows.find((row) => row.name === "Ёлка");
  expect(workshop?.countedOrders).toBe(1);
  expect(workshop?.countedCosts).toBe(
    Math.round(99_000 * 0.035) + Math.round(99_000 * 0.04),
  );
});

test("предоплата входит в выручку изделия, но не в его прибыль", () => {
  const [panno] = itemMargins(
    [
      order({
        items: [
          { name: "Панно", quantity: 1, price: 750_000 },
          { name: "Кашпо", quantity: 1, price: 250_000 },
        ],
        payments: [paid("2026-10-05", 300_000)],
        costLines: [line("materials", 125_000)],
      }),
    ],
    RATES,
    october,
  );
  expect(panno?.revenue).toBe(225_000);
  expect(panno?.countedOrders).toBe(0);
  expect(panno?.countedRevenue).toBe(0);
  expect(panno?.countedCosts).toBe(0);
});

test("два варианта одного изделия в заказе считаются одним заказом", () => {
  const rows = itemMargins(
    [
      order({
        items: [
          { name: "Панно", quantity: 1, price: 600_000 },
          { name: "Панно", quantity: 1, price: 400_000 },
        ],
        costLines: [line("materials", 100_000)],
      }),
    ],
    RATES,
    october,
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    orders: 1,
    countedOrders: 1,
    quantity: 2,
    revenue: 1_000_000,
    countedRevenue: 1_000_000,
    countedCosts: 175_000,
  });
});
