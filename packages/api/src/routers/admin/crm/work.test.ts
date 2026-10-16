import { expect, test } from "bun:test";
import type { Client } from "./model";
import { moscowDay } from "./model";
import {
  isOverdue,
  lastMonths,
  manualStage,
  newVsRepeat,
  productStage,
  toCollect,
  topItems,
  totals,
  totalsBy,
  type WorkOrder,
  workshopStage,
} from "./work";

/** Создаёт тестовый заказ с базовыми полями и указанными переопределениями. */
function order(overrides: Partial<WorkOrder> & Pick<WorkOrder, "id">) {
  return {
    kind: "manual",
    number: null,
    type: "external",
    channel: "avito",
    title: "Панно",
    clientName: "Анна",
    phone: null,
    email: null,
    clientKey: null,
    stage: "in_work",
    status: "in_production",
    amount: 1_000_000,
    payments: [],
    fee: 0,
    createdAt: new Date("2026-10-05T09:00:00Z"),
    dueOn: null,
    paymentDueAt: null,
    stageSince: null,
    closedAt: null,
    campaignId: null,
    items: [],
    ...overrides,
  } satisfies WorkOrder;
}

const october = {
  from: moscowDay("2026-10-01"),
  to: moscowDay("2026-11-01"),
};

test("статусы источников сводятся к общим этапам", () => {
  expect(productStage("requested")).toBe("new");
  expect(productStage("awaiting_balance")).toBe("awaiting_payment");
  expect(productStage("ozon_order_failed")).toBe("in_work");
  expect(productStage("ready_to_ship")).toBe("ready");
  expect(productStage("declined")).toBe("canceled");
  // Неоплаченная корзина — не в работе
  expect(productStage("pending")).toBe("unpaid");
  // Незнакомый статус не теряется из работы
  expect(productStage("something_new")).toBe("in_work");
  expect(workshopStage("paid")).toBe("done");
  expect(manualStage("in_production")).toBe("in_work");
});

test("к получению — недоплата по заказам в работе", () => {
  const paid = [{ at: new Date("2026-10-06T09:00:00Z"), amount: 400_000 }];
  expect(toCollect(order({ id: "a", payments: paid }))).toBe(600_000);
  expect(toCollect(order({ id: "b", stage: "done", payments: paid }))).toBe(0);
  // Переплата не уходит в минус
  expect(
    toCollect(
      order({
        id: "c",
        amount: 100,
        payments: [{ at: new Date(), amount: 500 }],
      }),
    ),
  ).toBe(0);
});

test("просрочка: срок прошёл и не отправлен, или истекла ссылка на оплату", () => {
  const now = new Date("2026-10-16T09:00:00Z");
  expect(
    isOverdue(order({ id: "a", dueOn: "2026-10-15" }), "2026-10-16", now),
  ).toBe(true);
  // Срок — сегодня: ещё не просрочен
  expect(
    isOverdue(order({ id: "b", dueOn: "2026-10-16" }), "2026-10-16", now),
  ).toBe(false);
  // Отправлен вовремя или нет — уже в пути
  expect(
    isOverdue(
      order({ id: "c", dueOn: "2026-10-01", stage: "shipped" }),
      "2026-10-16",
      now,
    ),
  ).toBe(false);
  expect(
    isOverdue(
      order({ id: "d", dueOn: "2026-10-01", stage: "done" }),
      "2026-10-16",
      now,
    ),
  ).toBe(false);
  expect(
    isOverdue(
      order({
        id: "e",
        stage: "awaiting_payment",
        paymentDueAt: new Date("2026-10-15T00:00:00Z"),
      }),
      "2026-10-16",
      now,
    ),
  ).toBe(true);
});

test("итоги периода: оформленные, выручка по дням оплат, средний чек и комиссия", () => {
  const orders = [
    // Предоплата в сентябре, доплата в октябре: заказ оплачен впервые в сентябре
    order({
      id: "split",
      createdAt: new Date("2026-09-20T09:00:00Z"),
      payments: [
        { at: new Date("2026-09-21T09:00:00Z"), amount: 500_000 },
        { at: new Date("2026-10-10T09:00:00Z"), amount: 500_000 },
      ],
    }),
    order({
      id: "ozon",
      channel: "ozon",
      amount: 300_000,
      fee: 60_000,
      payments: [{ at: new Date("2026-10-07T09:00:00Z"), amount: 300_000 }],
    }),
    order({ id: "canceled", stage: "canceled" }),
    // Брошенная корзина и заявка не считаются оформленными заказами
    order({ id: "cart", kind: "product", stage: "unpaid", channel: "site" }),
    order({ id: "1042", kind: "request", stage: "new", channel: "site" }),
  ];

  const sum = totals(orders, october);
  expect(sum.placed).toBe(2);
  expect(sum.canceled).toBe(1);
  expect(sum.revenue).toBe(800_000);
  expect(sum.paidOrders).toBe(1);
  expect(sum.paidOrdersAmount).toBe(300_000);
  expect(sum.fees).toBe(60_000);

  const channels = totalsBy(orders, october, (o) => o.channel);
  expect(channels.get("avito")?.revenue).toBe(500_000);
  expect(channels.get("ozon")?.revenue).toBe(300_000);
  expect(channels.get("site")?.placed).toBe(0);
});

test("лучшие товары — по позициям заказов, впервые оплаченных за период", () => {
  const paid = [{ at: new Date("2026-10-07T09:00:00Z"), amount: 1 }];
  const top = topItems(
    [
      order({
        id: "1",
        payments: paid,
        items: [{ name: "Абажур", quantity: 2, price: 500_000 }],
      }),
      order({
        id: "2",
        payments: paid,
        items: [
          { name: "Туника", quantity: 1, price: 700_000 },
          { name: "Абажур", quantity: 1, price: 500_000 },
        ],
      }),
      order({
        id: "3",
        items: [{ name: "Туника", quantity: 5, price: 700_000 }],
      }),
    ],
    october,
  );
  expect(top.map((item) => [item.name, item.quantity, item.revenue])).toEqual([
    ["Абажур", 3, 1_500_000],
    ["Туника", 1, 700_000],
  ]);
});

test("вернувшийся покупатель — впервые заплатил до начала периода", () => {
  const client = (key: string, firstPaidAt: Date, paidAt: Date[]) =>
    ({
      key,
      firstPaidAt,
      deals: [{ payments: paidAt.map((at) => ({ at, amount: 100 })) }],
    }) as unknown as Client;
  const result = newVsRepeat(
    [
      client("old", new Date("2026-08-01T09:00:00Z"), [
        new Date("2026-08-01T09:00:00Z"),
        new Date("2026-10-03T09:00:00Z"),
      ]),
      client("new", new Date("2026-10-05T09:00:00Z"), [
        new Date("2026-10-05T09:00:00Z"),
      ]),
    ],
    october,
  );
  expect(result).toEqual({
    newRevenue: 100,
    repeatRevenue: 100,
    newBuyers: 1,
    repeat: 1,
  });
});

test("последние месяцы — по Москве, старые первыми", () => {
  // 30 сентября 22:00 UTC — уже 1 октября в Москве
  const months = lastMonths(new Date("2026-09-30T22:00:00Z"), 3);
  expect(months.map((m) => m.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
  expect(months[2]?.period.from).toEqual(moscowDay("2026-10-01"));
});
