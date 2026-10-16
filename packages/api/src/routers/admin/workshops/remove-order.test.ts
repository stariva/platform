import { expect, mock, test } from "bun:test";

// Importing the router creates a pool; these tests only use the fake DB below.
const originalUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL ??=
  "postgres://postgres@localhost/workshop_remove_test";
const { removeOrder } = await import("./remove-order");
if (originalUrl === undefined) delete process.env.POSTGRES_URL;

interface FakeOrder {
  status: string;
  paidAt: Date | null;
}

function request(order: FakeOrder | undefined, force = false) {
  const deleteWhere = mock(async () => undefined);
  const del = mock(() => ({ where: deleteWhere }));
  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({ for: async () => (order ? [order] : []) }),
      }),
    }),
    delete: del,
  };
  const handler = removeOrder["~orpc"].handler;
  const context = {
    db: { transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
  } as unknown as Parameters<typeof handler>[0]["context"];
  return {
    del,
    result: handler({
      context,
      input: { id: "order", force },
      path: [],
      procedure: removeOrder,
      errors: {},
      lastEventId: undefined,
    }),
  };
}

test("removeOrder deletes an unpaid canceled order", async () => {
  const { result, del } = request({ status: "canceled", paidAt: null });
  await expect(result).resolves.toEqual({ ok: true });
  expect(del).toHaveBeenCalled();
});

test("removeOrder refuses an order awaiting payment", async () => {
  const { result, del } = request({ status: "pending", paidAt: null });
  await expect(result).rejects.toMatchObject({ code: "CONFLICT" });
  expect(del).not.toHaveBeenCalled();
});

test("removeOrder refuses a paid order", async () => {
  const { result, del } = request({ status: "paid", paidAt: new Date() });
  await expect(result).rejects.toMatchObject({ code: "CONFLICT" });
  expect(del).not.toHaveBeenCalled();
});

test("removeOrder refuses a canceled order that was once paid", async () => {
  const { result, del } = request({ status: "canceled", paidAt: new Date() });
  await expect(result).rejects.toMatchObject({ code: "CONFLICT" });
  expect(del).not.toHaveBeenCalled();
});

test("removeOrder reports a missing order", async () => {
  const { result } = request(undefined);
  await expect(result).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("removeOrder deletes a paid order when forced", async () => {
  const { result, del } = request(
    { status: "refunded", paidAt: new Date() },
    true,
  );
  await expect(result).resolves.toEqual({ ok: true });
  expect(del).toHaveBeenCalled();
});

test("removeOrder deletes an order awaiting payment when forced", async () => {
  const { result, del } = request({ status: "pending", paidAt: null }, true);
  await expect(result).resolves.toEqual({ ok: true });
  expect(del).toHaveBeenCalled();
});
