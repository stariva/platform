import { expect, test } from "bun:test";

// Importing the router creates a pool; these tests only use the fake DB below.
const originalUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL ??=
  "postgres://postgres@localhost/request_remove_test";
const { remove } = await import("./remove");
if (originalUrl === undefined) delete process.env.POSTGRES_URL;

function request({
  deleted = false,
  error,
}: {
  deleted?: boolean;
  error?: unknown;
}) {
  const db = {
    delete: () => ({
      where: () => ({
        returning: async () => {
          if (error) throw error;
          return deleted ? [{ number: 1042 }] : [];
        },
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
  await expect(request({ deleted: true })).resolves.toEqual({
    number: 1042,
  });
});

const foreignKeyError = {
  code: "23503",
  constraint: "crm_sales_request_number_custom_order_requests_number_fk",
};

test.each(
  ["23503", "23001"].flatMap((code) => [
    { ...foreignKeyError, code },
    { cause: { ...foreignKeyError, code } },
  ]),
)(
  "remove maps a direct or wrapped request FK violation to a conflict: %j",
  async (error) => {
    await expect(request({ error })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "По заявке записан заказ — сначала удалите заказ",
    });
  },
);

test.each([
  new Error("database unavailable"),
  { code: "23503", constraint: "another_fk" },
  { code: "23001", constraint: "another_fk" },
  { ...foreignKeyError, code: "23505" },
])("remove propagates unrelated database errors: %j", async (error) => {
  await expect(request({ error })).rejects.toBe(error);
});

test("remove reports a missing request", async () => {
  await expect(request({})).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("remove refuses a request with an invoiced site order", async () => {
  await expect(
    request({
      error: {
        code: "23503",
        constraint:
          "product_orders_request_number_custom_order_requests_number_fk",
      },
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
});
