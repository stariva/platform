import { expect, test } from "bun:test";
import {
  crmSalePayments,
  crmSales,
  customOrderRequests,
  productOrders,
} from "@stariva/db";
import { orders } from "./orders";

const sales = Array.from({ length: 501 }, (_, index) => ({
  id: `manual-${index}`,
  clientId: "client",
  description: "Панно",
  channel: "avito",
  status: "new",
  amount: 10_000,
  fee: 0,
  soldOn: "2026-10-01",
  dueOn: "2000-01-01",
  requestNumber: null,
}));
const rowsByTable = new Map<unknown, unknown[]>([
  [crmSales, [...sales, { ...sales[0], id: "done", status: "done" }]],
  [
    crmSalePayments,
    sales.map((sale) => ({
      saleId: sale.id,
      amount: 1_000,
      paidOn: "2026-10-01",
    })),
  ],
  [
    productOrders,
    [
      {
        id: "product",
        number: 1,
        kind: "made_to_order",
        status: "requested",
        amountTotal: 25_000,
        contactName: "Анна",
        createdAt: new Date("2026-10-01T10:00:00Z"),
      },
    ],
  ],
  [
    customOrderRequests,
    Array.from({ length: 3 }, (_, index) => ({
      number: index + 1,
      name: "Анна",
      createdAt: new Date(),
    })),
  ],
]);

function list(input: Partial<Parameters<typeof handler>[0]["input"]> = {}) {
  return handler({
    context: {
      db: {
        select: () => ({
          from: (table: unknown) => {
            const rows = Promise.resolve(rowsByTable.get(table) ?? []);
            return Object.assign(rows, {
              orderBy: () => rows,
              where: () => rows,
              innerJoin: () => ({ leftJoin: () => rows }),
            });
          },
        }),
      },
    } as unknown as Parameters<typeof handler>[0]["context"],
    input: { view: "active", limit: 500, offset: 0, ...input },
    path: [],
    procedure: orders,
    errors: {},
    lastEventId: undefined,
  });
}
const handler = orders["~orpc"].handler;

test("полные агрегаты различают новые заказы и заявки за пределами страницы", async () => {
  const first = await list();
  const second = await list({ offset: 500 });
  expect(first.items).toHaveLength(500);
  expect(second.items).toHaveLength(5);
  expect(first.total).toBe(505);
  expect(first.kinds).toEqual([
    { kind: "product", count: 1 },
    { kind: "workshop", count: 0 },
    { kind: "manual", count: 501 },
    { kind: "request", count: 3 },
  ]);
  expect(first.stages.find((row) => row.stage === "new")).toEqual({
    stage: "new",
    count: 505,
    amount: 50_350,
    toCollect: 45_340,
    overdue: 501,
  });
  expect(second.kinds).toEqual(first.kinds);
  expect(second.stages).toEqual(first.stages);
  const cards = [...first.items, ...second.items];
  expect(new Set(cards.map((row) => `${row.kind}:${row.id}`)).size).toBe(505);
});

test("агрегаты учитывают фильтры площадки и вида и исключают заявки из списка", async () => {
  const filtered = await list({ channel: "avito", type: "external" });
  expect(filtered.total).toBe(501);
  expect(filtered.kinds.find((row) => row.kind === "manual")?.count).toBe(501);
  expect(filtered.kinds.find((row) => row.kind === "request")?.count).toBe(0);
  const all = await list({ view: "all" });
  expect(all.total).toBe(503);
  expect(all.kinds.find((row) => row.kind === "request")?.count).toBe(0);
});
