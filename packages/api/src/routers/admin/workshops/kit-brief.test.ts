import { expect, mock, test } from "bun:test";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const deliver = mock(async () => ({ to: "buyer@example.com", warning: null }));
mock.module("./brief", () => ({ sendBriefForOrder: deliver }));
const originalUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL ??= "postgres://postgres@localhost/kit_brief_test";
const { sendKitBrief } = await import("./kit-brief");
if (originalUrl === undefined) delete process.env.POSTGRES_URL;

function request(
  status: string,
  linked = true,
  existing = true,
  accounts: { id: string }[] = [{ id: "buyer" }],
  bookedFails = false,
) {
  const rows = [
    [
      {
        id: "kit",
        status,
        userId: null,
        contactEmail: " Buyer@Example.COM ",
        contactName: "Buyer",
        visitor: null,
      },
    ],
    linked ? [{ id: "item" }] : [],
    [{ slug: "course", materialFiles: ["brief.pdf"] }],
    existing ? [{ id: "workshop-order" }] : [],
    accounts,
    [{ id: "new-buyer" }],
  ];
  const conditions: unknown[] = [];
  const inserts: unknown[] = [];
  const upsert = mock(async () => {
    if (bookedFails) throw new Error("write failed");
  });
  const db = {
    select: () => {
      const result = rows.shift() ?? [];
      const query = {
        from: () => query,
        leftJoin: () => query,
        where: (condition: unknown) => {
          conditions.push(condition);
          return Object.assign(Promise.resolve(result), {
            limit: async () => result,
          });
        },
      };
      return query;
    },
    insert: () => ({
      values: (value: unknown) => {
        inserts.push(value);
        return {
          onConflictDoNothing: async () => {},
          onConflictDoUpdate: upsert,
        };
      },
    }),
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  const handler = sendKitBrief["~orpc"].handler;
  const result = handler({
    context: { db } as unknown as Parameters<typeof handler>[0]["context"],
    input: { orderId: "kit", workshopSlug: "course" },
    path: [],
    procedure: sendKitBrief,
    errors: {},
    lastEventId: undefined,
  });
  return { result, inserts, upsert, conditions };
}

for (const status of [
  "declined",
  "awaiting_balance",
  "in_production",
  "pending",
  "refunded",
  "awaiting_deposit",
  "requested",
  "canceled",
]) {
  test(`rejects ${status} before issuing access or sending`, async () => {
    const { result, inserts } = request(status);
    await expect(result).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(inserts).toHaveLength(0);
  });
}

test("rejects a workshop outside the order", async () => {
  const { result, inserts, conditions } = request("paid", false);
  await expect(result).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(inserts).toHaveLength(0);
  const query = new PgDialect().sqlToQuery(conditions[1] as SQL);
  expect(query.sql).toContain(
    'case when "product_order_items"."workshop_link_captured" then "product_order_items"."workshop_slug" else "products"."workshop_slug" end',
  );
  expect(query.params).toEqual(["kit", "course"]);
});

for (const existing of [false, true]) {
  test(`records booked after delivery, existing=${existing}`, async () => {
    const { result, inserts, upsert } = request("paid", true, existing);
    await expect(result).resolves.toMatchObject({
      opened: !existing,
      warning: null,
    });
    expect(inserts).toContainEqual(
      expect.objectContaining({ kind: "booked", channel: "email" }),
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({
          sentAt: expect.anything(),
          leaseUntil: null,
        }),
      }),
    );
    if (!existing)
      expect(inserts).toContainEqual(
        expect.objectContaining({ contactEmail: "buyer@example.com" }),
      );
  });
}

test("rejects ambiguous case-insensitive accounts without creating access", async () => {
  const { result, inserts } = request("paid", true, false, [
    { id: "one" },
    { id: "two" },
  ]);
  await expect(result).rejects.toMatchObject({ code: "CONFLICT" });
  expect(inserts).toHaveLength(0);
});

test("returns a delivery warning when booked persistence fails", async () => {
  const { result } = request("paid", true, true, [], true);
  await expect(result).resolves.toMatchObject({
    warning: expect.stringContaining("Письмо отправлено"),
  });
});

test("normalizes email on both the new account and workshop order", async () => {
  const { result, inserts } = request("paid", true, false, []);
  await expect(result).resolves.toMatchObject({ opened: true });
  expect(inserts).toContainEqual(
    expect.objectContaining({ email: "buyer@example.com" }),
  );
  expect(inserts).toContainEqual(
    expect.objectContaining({ contactEmail: "buyer@example.com" }),
  );
});
