import { expect, mock, test } from "bun:test";

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
const { requestBalance, requestBalanceWithOzon } = await import("./stages");
if (originalUrl === undefined) delete process.env.POSTGRES_URL;

function fakeDb(amountProducts: number) {
  const set = mock(() => ({
    where: () => ({
      returning: async () => [{ id: "order", status: "awaiting_balance" }],
    }),
  }));
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
  return { db, set, update };
}

function requestWithOzon(amountProducts: number) {
  const { db, set, update } = fakeDb(amountProducts);
  const handler = requestBalanceWithOzon["~orpc"].handler;
  return {
    set,
    update,
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
