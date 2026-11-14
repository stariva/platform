import { expect, mock, test } from "bun:test";

// Importing the router creates a pool; these tests only use the fake DB below.
const originalUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL ??= "postgres://postgres@localhost/cart_event_test";
const { removeEvent } = await import("./remove-event");
if (originalUrl === undefined) delete process.env.POSTGRES_URL;

function call({
  deleted,
  remaining = 0,
  countError,
}: {
  deleted: boolean;
  remaining?: number;
  countError?: Error;
}) {
  const tx = {
    delete: () => ({
      where: () => ({
        returning: async () => (deleted ? [{ id: "e1", cartId: "c1" }] : []),
      }),
    }),
    select: () => ({
      from: () => ({
        where: async () => {
          if (countError) throw countError;
          return [{ value: remaining }];
        },
      }),
    }),
  };
  const transaction = mock(
    async (callback: (db: typeof tx) => Promise<unknown>) => callback(tx),
  );
  const db = { transaction };
  const handler = removeEvent["~orpc"].handler;
  const result = handler({
    context: { db } as unknown as Parameters<typeof handler>[0]["context"],
    input: { id: "e1" },
    path: [],
    procedure: removeEvent,
    errors: {},
    lastEventId: undefined,
  });
  return { result, transaction };
}

test("removeEvent reports how many events the cart has left", async () => {
  await expect(call({ deleted: true, remaining: 3 }).result).resolves.toEqual({
    id: "e1",
    cartId: "c1",
    remaining: 3,
  });
});

test("removeEvent reports an emptied cart", async () => {
  await expect(call({ deleted: true }).result).resolves.toMatchObject({
    remaining: 0,
  });
});

test("removeEvent reports a missing event", async () => {
  await expect(call({ deleted: false }).result).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});

test("removeEvent propagates count failures out of the transaction", async () => {
  const error = new Error("Count failed");
  const { result, transaction } = call({ deleted: true, countError: error });

  await expect(result).rejects.toBe(error);
  expect(transaction).toHaveBeenCalledTimes(1);
  await expect(transaction.mock.results[0]?.value).rejects.toBe(error);
});
