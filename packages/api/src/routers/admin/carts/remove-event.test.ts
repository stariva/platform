import { expect, test } from "bun:test";

// Importing the router creates a pool; these tests only use the fake DB below.
const originalUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL ??= "postgres://postgres@localhost/cart_event_test";
const { removeEvent } = await import("./remove-event");
if (originalUrl === undefined) delete process.env.POSTGRES_URL;

function call({
  deleted,
  remaining = 0,
}: {
  deleted: boolean;
  remaining?: number;
}) {
  const db = {
    delete: () => ({
      where: () => ({
        returning: async () => (deleted ? [{ id: "e1", cartId: "c1" }] : []),
      }),
    }),
    select: () => ({
      from: () => ({ where: async () => [{ value: remaining }] }),
    }),
  };
  const handler = removeEvent["~orpc"].handler;
  return handler({
    context: { db } as unknown as Parameters<typeof handler>[0]["context"],
    input: { id: "e1" },
    path: [],
    procedure: removeEvent,
    errors: {},
    lastEventId: undefined,
  });
}

test("removeEvent reports how many events the cart has left", async () => {
  await expect(call({ deleted: true, remaining: 3 })).resolves.toEqual({
    id: "e1",
    cartId: "c1",
    remaining: 3,
  });
});

test("removeEvent reports an emptied cart", async () => {
  await expect(call({ deleted: true })).resolves.toMatchObject({
    remaining: 0,
  });
});

test("removeEvent reports a missing event", async () => {
  await expect(call({ deleted: false })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
