import { expect, mock, test } from "bun:test";

// Importing the router creates a pool; these tests only use the fake DB below.
const originalUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL ??= "postgres://postgres@localhost/order_balance_test";
const { requestBalance } = await import("./stages");
if (originalUrl === undefined) delete process.env.POSTGRES_URL;

function request(amountProducts: number, amountDelivery: number) {
  const set = mock(() => ({
    where: () => ({
      returning: async () => [{ id: "order", status: "awaiting_balance" }],
    }),
  }));
  const update = mock(() => ({ set }));
  const handler = requestBalance["~orpc"].handler;
  const context = {
    db: {
      select: () => ({
        from: () => ({
          where: async () => [{ amountProducts, depositAmount: 100 }],
        }),
      }),
      update,
    },
  } as unknown as Parameters<typeof handler>[0]["context"];
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
