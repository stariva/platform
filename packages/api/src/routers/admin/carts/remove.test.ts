import { expect, test } from "bun:test";

// Importing the router creates a pool; these tests only use the fake DB below.
const originalUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL ??= "postgres://postgres@localhost/cart_remove_test";
const { remove } = await import("./remove");
if (originalUrl === undefined) delete process.env.POSTGRES_URL;

function call(rows: { id: string }[]) {
  const db = {
    delete: () => ({
      where: () => ({ returning: async () => rows }),
    }),
  };
  const handler = remove["~orpc"].handler;
  return handler({
    context: { db } as unknown as Parameters<typeof handler>[0]["context"],
    input: { id: "c1" },
    path: [],
    procedure: remove,
    errors: {},
    lastEventId: undefined,
  });
}

test("remove reports how many events were deleted with the cart", async () => {
  await expect(call([{ id: "e1" }, { id: "e2" }])).resolves.toEqual({
    cartId: "c1",
    removed: 2,
  });
});

test("remove reports a missing cart", async () => {
  await expect(call([])).rejects.toMatchObject({ code: "NOT_FOUND" });
});
