import { expect, mock, test } from "bun:test";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const recipient = {
  to: "buyer@example.com",
  accessToken: "token",
  slug: "course",
  orderId: "workshop-order",
};
const originalUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL ??= "postgres://postgres@localhost/kit_access_test";
// mock.module живёт на весь прогон bun test: остальные экспорты модулей
// оставляем настоящими, иначе другие файлы не найдут своих имён
const realBrief = await import("./brief");
mock.module("./brief", () => ({
  ...realBrief,
  accessUrl: () => "https://stariva.test/access",
  errorReason: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  recipientColumns: {},
}));
const sendAccess = mock(async (_email: unknown) => {});
const emails = await import("@stariva/emails");
mock.module("@stariva/emails", () => ({
  ...emails,
  sendKitAccessEmail: sendAccess,
}));
const { sendKitAccess } = await import("./kit-access");
if (originalUrl === undefined) delete process.env.POSTGRES_URL;

function request(
  status: string,
  linked = true,
  existing = true,
  accounts: { id: string }[] = [{ id: "buyer" }],
  bookedFails = false,
  releaseAt: Date | null = null,
  gift = false,
) {
  const rows: unknown[][] = [
    [
      {
        id: "kit",
        status,
        gift,
        userId: null,
        contactEmail: " Buyer@Example.COM ",
        contactName: "Buyer",
        visitor: null,
      },
    ],
    linked ? [{ id: "item" }] : [],
    [{ slug: "course", title: "Course", releaseAt }],
    existing ? [{ id: "workshop-order" }] : [],
  ];
  if (!existing) {
    rows.push(accounts);
    // Аккаунта не нашлось — его создают и ищут ещё раз
    if (accounts.length === 0) rows.push([{ id: "new-buyer" }]);
  }
  rows.push([recipient]);
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
        innerJoin: () => query,
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
  const handler = sendKitAccess["~orpc"].handler;
  const result = handler({
    context: { db } as unknown as Parameters<typeof handler>[0]["context"],
    input: { orderId: "kit", workshopSlug: "course" },
    path: [],
    procedure: sendKitAccess,
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
    sendAccess.mockClear();
    const { result, inserts } = request(status);
    await expect(result).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(inserts).toHaveLength(0);
    expect(sendAccess).not.toHaveBeenCalled();
  });
}

test("rejects a gift order: access goes by code, not by email", async () => {
  sendAccess.mockClear();
  const { result, inserts } = request(
    "paid",
    true,
    false,
    [],
    false,
    null,
    true,
  );
  await expect(result).rejects.toMatchObject({
    code: "BAD_REQUEST",
    message: expect.stringContaining("подарок"),
  });
  expect(inserts).toHaveLength(0);
  expect(sendAccess).not.toHaveBeenCalled();
});

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
  test(`sends the access email and records booked, existing=${existing}`, async () => {
    sendAccess.mockClear();
    const { result, inserts, upsert } = request("paid", true, existing);
    await expect(result).resolves.toMatchObject({
      to: "buyer@example.com",
      opened: !existing,
      warning: null,
    });
    expect(sendAccess).toHaveBeenCalledWith({
      to: "buyer@example.com",
      workshopTitle: "Course",
      accessUrl: "https://stariva.test/access",
      releaseAt: null,
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

test("passes the release date of a lesson that is not out yet", async () => {
  sendAccess.mockClear();
  const releaseAt = new Date("2099-01-01T07:00:00Z");
  const { result } = request("paid", true, true, [], false, releaseAt);
  await expect(result).resolves.toMatchObject({ warning: null });
  expect(sendAccess).toHaveBeenCalledWith(
    expect.objectContaining({ releaseAt }),
  );
});

test("does not record booked when the email fails", async () => {
  sendAccess.mockClear();
  sendAccess.mockRejectedValueOnce(new Error("provider down"));
  const { result, inserts } = request("paid");
  await expect(result).rejects.toMatchObject({ code: "BAD_GATEWAY" });
  expect(inserts).toHaveLength(0);
});

test("rejects ambiguous case-insensitive accounts without creating access", async () => {
  sendAccess.mockClear();
  const { result, inserts } = request("paid", true, false, [
    { id: "one" },
    { id: "two" },
  ]);
  await expect(result).rejects.toMatchObject({ code: "CONFLICT" });
  expect(inserts).toHaveLength(0);
  expect(sendAccess).not.toHaveBeenCalled();
});

test("returns a warning when booked persistence fails", async () => {
  const { result } = request("paid", true, true, [], true);
  await expect(result).resolves.toMatchObject({
    recorded: false,
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
