import { expect, test } from "bun:test";
import type { Database } from "@stariva/db";
import { orders } from "@stariva/db/schema";

const originalUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL ??= "postgres://postgres@localhost/boosty_test";
const { confirmBoostyAccess } = await import("./confirm-boosty");
if (originalUrl === undefined) delete process.env.POSTGRES_URL;

const releaseAt = new Date("2026-12-01T07:00:00Z");

function createDb(
  orderedAt: Date,
  requestedAt = new Date("2026-12-02T10:00:00Z"),
) {
  const order = {
    id: "boosty-order",
    userId: "buyer",
    workshopSlug: "elka-makrame",
    paymentId: "boosty:elka-makrame",
    boostyActivationRequestedAt: requestedAt,
    createdAt: orderedAt,
    status: "pending" as "pending" | "paid",
  };
  const access = new Map<string, { orderId: string; workshopSlug: string }>();
  let updates = 0;
  const tx = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          for: async () => (table === orders ? [order] : []),
          limit: async () => [{ releaseAt }],
        }),
      }),
    }),
    update: () => ({
      set: (value: { status: "paid" }) => ({
        where: async () => {
          updates++;
          order.status = value.status;
        },
      }),
    }),
    insert: () => ({
      values: (value: { orderId: string; workshopSlug: string }) => ({
        onConflictDoNothing: async () => {
          if (!access.has(value.workshopSlug)) {
            access.set(value.workshopSlug, value);
          }
        },
      }),
    }),
  };
  const db = { transaction: (run: (t: typeof tx) => unknown) => run(tx) };
  return {
    db: db as unknown as Database,
    access,
    updates: () => updates,
  };
}

test("preorder confirmation grants the main and gift course from the same order", async () => {
  const { db, access, updates } = createDb(
    new Date("2026-11-25T10:00:00Z"),
    new Date("2026-11-26T10:00:00Z"),
  );
  await confirmBoostyAccess(db, "boosty-order");
  expect(updates()).toBe(1);
  expect(
    [...access.values()].map(({ orderId, workshopSlug }) => ({
      orderId,
      workshopSlug,
    })),
  ).toEqual([
    { orderId: "boosty-order", workshopSlug: "elka-makrame" },
    { orderId: "boosty-order", workshopSlug: "elka-makrame-bolshaya" },
  ]);
});

test("confirmation after release still grants the gift for an earlier order", async () => {
  const { db, access } = createDb(new Date("2026-11-25T10:00:00Z"));
  await confirmBoostyAccess(db, "boosty-order");
  expect(access.has("elka-makrame-bolshaya")).toBe(true);
});

test("an order placed after release has no preorder gift", async () => {
  const { db, access } = createDb(new Date("2026-12-02T10:00:00Z"));
  await confirmBoostyAccess(db, "boosty-order");
  expect([...access.keys()]).toEqual(["elka-makrame"]);
});

test("repeated confirmation does not duplicate access or change the paid order", async () => {
  const { db, access, updates } = createDb(new Date("2026-11-25T10:00:00Z"));
  await confirmBoostyAccess(db, "boosty-order");
  await confirmBoostyAccess(db, "boosty-order");
  expect(updates()).toBe(1);
  expect(access.size).toBe(2);
});
