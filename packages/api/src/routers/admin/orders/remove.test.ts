import { expect, mock, test } from "bun:test";

// Importing the router creates a pool; these tests only use the fake DB below.
const originalUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL ??= "postgres://postgres@localhost/order_remove_test";
const { remove } = await import("./remove");
if (originalUrl === undefined) delete process.env.POSTGRES_URL;

interface FakeOrder {
  status: string;
  paidAt: Date | null;
  depositPaidAt: Date | null;
}

function request(order: FakeOrder | undefined, openPayment = false) {
  const deleteWhere = mock(async () => undefined);
  const del = mock(() => ({ where: deleteWhere }));
  const tx = {
    select: (fields: Record<string, unknown>) => ({
      from: () => ({
        where: () =>
          "status" in fields
            ? { for: async () => (order ? [order] : []) }
            : { limit: async () => (openPayment ? [{ id: "payment" }] : []) },
      }),
    }),
    delete: del,
  };
  const handler = remove["~orpc"].handler;
  const context = {
    db: { transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
  } as unknown as Parameters<typeof handler>[0]["context"];
  return {
    del,
    result: handler({
      context,
      input: { id: "order" },
      path: [],
      procedure: remove,
      errors: {},
      lastEventId: undefined,
    }),
  };
}

const unpaid = { paidAt: null, depositPaidAt: null };

test("remove deletes an unpaid declined order", async () => {
  const { result, del } = request({ status: "declined", ...unpaid });
  await expect(result).resolves.toEqual({ ok: true });
  expect(del).toHaveBeenCalled();
});

test("remove refuses a paid order", async () => {
  const { result, del } = request({
    status: "canceled",
    paidAt: null,
    depositPaidAt: new Date(),
  });
  await expect(result).rejects.toMatchObject({ code: "CONFLICT" });
  expect(del).not.toHaveBeenCalled();
});

test("remove refuses an order still awaiting payment", async () => {
  const { result, del } = request({ status: "pending", ...unpaid });
  await expect(result).rejects.toMatchObject({ code: "CONFLICT" });
  expect(del).not.toHaveBeenCalled();
});

test("remove refuses a request with an open payment link", async () => {
  const { result, del } = request({ status: "requested", ...unpaid }, true);
  await expect(result).rejects.toMatchObject({ code: "CONFLICT" });
  expect(del).not.toHaveBeenCalled();
});

test("remove reports a missing order", async () => {
  const { result } = request(undefined);
  await expect(result).rejects.toMatchObject({ code: "NOT_FOUND" });
});
