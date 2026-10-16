import { expect, test } from "bun:test";

// Importing the router creates a pool; these tests only use the fake DB below.
const originalUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL ??=
  "postgres://postgres@localhost/request_remove_test";
const { remove } = await import("./remove");
if (originalUrl === undefined) delete process.env.POSTGRES_URL;

/** `deleted` — что вернёт delete…returning; `exists` — есть ли заявка при повторной проверке. */
function request({ deleted, exists }: { deleted: boolean; exists: boolean }) {
  const db = {
    delete: () => ({
      where: () => ({
        returning: async () => (deleted ? [{ number: 1042 }] : []),
      }),
    }),
    select: () => ({
      from: () => ({
        where: async () => (exists ? [{ number: 1042 }] : []),
      }),
    }),
  };
  const handler = remove["~orpc"].handler;
  return handler({
    context: { db } as unknown as Parameters<typeof handler>[0]["context"],
    input: { number: 1042 },
    path: [],
    procedure: remove,
    errors: {},
    lastEventId: undefined,
  });
}

test("remove deletes a request without an order", async () => {
  await expect(request({ deleted: true, exists: true })).resolves.toEqual({
    number: 1042,
  });
});

test("remove refuses a request that already has an order", async () => {
  await expect(request({ deleted: false, exists: true })).rejects.toMatchObject(
    { code: "CONFLICT" },
  );
});

test("remove reports a missing request", async () => {
  await expect(
    request({ deleted: false, exists: false }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
