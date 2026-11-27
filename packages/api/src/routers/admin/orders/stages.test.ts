import { expect, mock, test } from "bun:test";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const sweep = mock(async () => ({
  checked: 1,
  repriced: 0,
  shipped: 1,
  failed: 0,
}));

mock.module("../../../storefront", () => ({
  pushStorefrontStockToOzon: async () => true,
  revalidateStorefront: async () => true,
  sweepStorefrontOzonDeliveries: sweep,
}));

const parcel = { weightGrams: 800, lengthCm: 60, widthCm: 30, heightCm: 20 };

// Importing the router creates a pool; these tests only use the fake DB below.
const originalUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL ??= "postgres://postgres@localhost/order_balance_test";
const { cancel, completeProduction, requestBalance, requestBalanceWithOzon } =
  await import("./stages");
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

test("the Ozon balance is the products without delivery and keeps only the parcel", async () => {
  const { result, set } = requestWithOzon(390000);
  await expect(result).resolves.toMatchObject({ status: "awaiting_balance" });
  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "awaiting_balance",
      // Доставку добавит покупатель, когда выберет пункт и сайт её посчитает
      amountDelivery: 0,
      amountTotal: 390000,
      checkoutSnapshot: { parcel, priceKopecks: null },
    }),
  );
});

test("a balance billed by hand has nothing to bill when the deposit covers the products", async () => {
  const { result, update } = request(100, 0);
  await expect(result).rejects.toMatchObject({
    code: "BAD_REQUEST",
    message: "Доплачивать нечего — проверьте суммы",
  });
  expect(update).not.toHaveBeenCalled();
});

test("the Ozon balance may be zero before the buyer adds the delivery", async () => {
  // Предоплата равна цене изделия (например, 1 ₽): платить будет доставка Ozon
  const { result, set } = requestWithOzon(100);
  await expect(result).resolves.toMatchObject({ status: "awaiting_balance" });
  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({ amountDelivery: 0, amountTotal: 100 }),
  );
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

test("completeProduction moves a fully prepaid order to shipping and asks the storefront to create the parcel", async () => {
  sweep.mockClear();
  const { db, set, where } = fakeDb(0, [
    { id: "order", status: "ready_to_ship" },
  ]);
  const handler = completeProduction["~orpc"].handler;
  const result = await handler({
    context: { db } as unknown as Parameters<typeof handler>[0]["context"],
    input: { id: "order" },
    path: [],
    procedure: completeProduction,
    errors: {},
    lastEventId: undefined,
  });

  expect(result).toMatchObject({
    status: "ready_to_ship",
    ozonSweep: { shipped: 1 },
  });
  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({ status: "ready_to_ship" }),
  );
  const condition = sqlOf(where.mock.calls[0]?.[0]);
  expect(condition).toContain('"deposit_amount" is not null');
  expect(condition).toContain(
    '"deposit_amount" = "product_orders"."amount_total"',
  );
  expect(sweep).toHaveBeenCalledTimes(1);
});
