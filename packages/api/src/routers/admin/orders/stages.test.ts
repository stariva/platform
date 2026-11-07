import { expect, mock, test } from "bun:test";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

let quote: {
  available: boolean;
  reason?: string;
  deliveryPriceKopecks: number;
} = { available: true, deliveryPriceKopecks: 45000 };
const quoted: unknown[][] = [];
mock.module("../../../storefront", () => ({
  pushStorefrontStockToOzon: async () => true,
  quoteStorefrontMadeToOrderDelivery: async (...args: unknown[]) => {
    quoted.push(args);
    return quote;
  },
  revalidateStorefront: async () => true,
}));

const parcel = { weightGrams: 800, lengthCm: 60, widthCm: 30, heightCm: 20 };

// Importing the router creates a pool; these tests only use the fake DB below.
const originalUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL ??= "postgres://postgres@localhost/order_balance_test";
const { cancel, requestBalance, requestBalanceWithOzon } = await import(
  "./stages"
);
if (originalUrl === undefined) delete process.env.POSTGRES_URL;

const dialect = new PgDialect();
/** Условие записи так, как оно уйдёт в базу. */
const sqlOf = (condition: unknown) =>
  dialect.sqlToQuery(condition as SQL).sql.replace(/\s+/g, " ");

function fakeDb(
  amountProducts: number,
  updated: unknown[] = [{ id: "order", status: "awaiting_balance" }],
) {
  const where = mock((_condition: unknown) => ({
    returning: async () => updated,
  }));
  const set = mock((_values: unknown) => ({ where }));
  const update = mock(() => ({ set }));
  const db = {
    select: () => ({
      from: () => ({
        where: async () => [{ amountProducts, depositAmount: 100 }],
        // emailCustomer читает заказ вместе с почтой аккаунта. Пустой
        // результат — письма нет, и тест не уходит в реальную рассылку.
        leftJoin: () => ({ where: async () => [] }),
      }),
    }),
    update,
  };
  return { db, set, update, where };
}

function requestWithOzon(amountProducts: number, updated?: unknown[]) {
  const { db, set, update, where } = fakeDb(amountProducts, updated);
  const handler = requestBalanceWithOzon["~orpc"].handler;
  return {
    set,
    update,
    where,
    result: handler({
      context: { db } as unknown as Parameters<typeof handler>[0]["context"],
      input: { id: "order", parcel },
      path: [],
      procedure: requestBalanceWithOzon,
      errors: {},
      lastEventId: undefined,
    }),
  };
}

function request(amountProducts: number, amountDelivery: number) {
  const { db, set, update } = fakeDb(amountProducts);
  const handler = requestBalance["~orpc"].handler;
  const context = { db } as unknown as Parameters<typeof handler>[0]["context"];
  return {
    update,
    set,
    result: handler({
      context,
      input: { id: "order", amountDelivery },
      path: [],
      procedure: requestBalance,
      errors: {},
      lastEventId: undefined,
    }),
  };
}

test("requestBalance rejects integer overflow before writing", async () => {
  const { result, update } = request(2_147_483_547, 1.01);
  await expect(result).rejects.toMatchObject({
    code: "BAD_REQUEST",
    message:
      "Сумма заказа слишком велика — проверьте цены и стоимость доставки",
  });
  expect(update).not.toHaveBeenCalled();
});

test("the Ozon quote goes into the balance", async () => {
  quote = { available: true, deliveryPriceKopecks: 45000 };
  const { result, set } = requestWithOzon(390000);
  await expect(result).resolves.toMatchObject({ status: "awaiting_balance" });
  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "awaiting_balance",
      amountDelivery: 45000,
      amountTotal: 435000,
    }),
  );
  expect(quoted.at(-1)).toEqual(["order", parcel]);
});

test("a refused Ozon quote keeps the order in production and shows why", async () => {
  quote = {
    available: false,
    reason: "Покупатель ещё не выбрал пункт выдачи",
    deliveryPriceKopecks: 0,
  };
  const { result, update } = requestWithOzon(390000);
  await expect(result).rejects.toMatchObject({
    code: "CONFLICT",
    message: "Покупатель ещё не выбрал пункт выдачи",
  });
  expect(update).not.toHaveBeenCalled();
});

test("a balance billed by hand drops the quote, so nothing ships through Ozon", async () => {
  const { result, set } = request(390000, 450);
  await expect(result).resolves.toMatchObject({ status: "awaiting_balance" });
  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({
      amountDelivery: 45000,
      checkoutSnapshot: null,
    }),
  );
});

test("the Ozon balance is written only while the saved quote still matches", async () => {
  quote = { available: true, deliveryPriceKopecks: 45000 };
  const { result, where } = requestWithOzon(390000);
  await result;
  const condition = sqlOf(where.mock.calls[0]?.[0]);
  // Смена пункта стирает расчёт, и такая доплата не должна пройти
  expect(condition).toContain('"checkout_snapshot" is not null');
  expect(condition).toContain("->> 'priceKopecks'");
});

test("a point changed during the quote stops the balance", async () => {
  quote = { available: true, deliveryPriceKopecks: 45000 };
  const { result } = requestWithOzon(390000, []);
  await expect(result).rejects.toMatchObject({
    code: "CONFLICT",
    message: expect.stringContaining("сменил пункт выдачи"),
  });
});

test("a balance billed by hand does not need a saved quote", async () => {
  const { result, where } = (() => {
    const { db, where } = fakeDb(390000);
    const handler = requestBalance["~orpc"].handler;
    return {
      where,
      result: handler({
        context: { db } as unknown as Parameters<typeof handler>[0]["context"],
        input: { id: "order", amountDelivery: 450 },
        path: [],
        procedure: requestBalance,
        errors: {},
        lastEventId: undefined,
      }),
    };
  })();
  await result;
  expect(sqlOf(where.mock.calls[0]?.[0])).not.toContain("checkout_snapshot");
});

function cancelOrder(updated: unknown[]) {
  const { db, where } = fakeDb(0, updated);
  const handler = cancel["~orpc"].handler;
  return {
    where,
    result: handler({
      context: { db } as unknown as Parameters<typeof handler>[0]["context"],
      input: { id: "order" },
      path: [],
      procedure: cancel,
      errors: {},
      lastEventId: undefined,
    }),
  };
}

test("an order cannot be canceled while Ozon shipment is being created", async () => {
  const { result, where } = cancelOrder([]);
  await expect(result).rejects.toMatchObject({
    code: "CONFLICT",
    message: expect.stringContaining("создаёт отправление Ozon"),
  });
  // Свежая попытка блокирует отмену, брошенная (старше срока аренды) — нет
  const condition = sqlOf(where.mock.calls[0]?.[0]);
  expect(condition).toContain('"ozon_shipment_status" <> $');
  expect(condition).toContain('"ozon_shipment_attempted_at" <= $');
});

test("requestBalance accepts the maximum integer total", async () => {
  const { result, set } = request(2_147_483_547, 1);
  await expect(result).resolves.toMatchObject({ status: "awaiting_balance" });
  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({
      amountTotal: 2_147_483_647,
      amountDelivery: 100,
    }),
  );
});
