import { test } from "bun:test";
import assert from "node:assert/strict";
import type { promoCodes } from "@stariva/db";
import { discountedReceiptItems, evaluatePromoCode } from "./promo-codes";

type PromoCodeRow = typeof promoCodes.$inferSelect;

const now = new Date("2026-12-10T12:00:00Z");

function promo(overrides: Partial<PromoCodeRow> = {}): PromoCodeRow {
  return {
    id: "promo-1",
    code: "NEWYEAR",
    description: "",
    discountType: "percent",
    discountValue: 10,
    active: true,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    usedCount: 0,
    minOrderAmount: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test("percent promo rounds the discount down to whole kopecks", () => {
  assert.deepEqual(evaluatePromoCode(promo(), 10_099, now), {
    valid: true,
    reason: null,
    code: "NEWYEAR",
    discountType: "percent",
    discountValue: 10,
    discountKopecks: 1009,
  });
});

test("fixed promo uses its kopecks amount", () => {
  const evaluation = evaluatePromoCode(
    promo({ discountType: "fixed", discountValue: 50_000 }),
    100_000,
    now,
  );
  assert.equal(evaluation.valid, true);
  assert.equal(evaluation.discountKopecks, 50_000);
});

test("inactive, future, expired and exhausted promos are rejected", () => {
  const future = new Date("2026-12-11T00:00:00Z");
  const past = new Date("2026-12-09T00:00:00Z");
  for (const row of [
    promo({ active: false }),
    promo({ startsAt: future }),
    promo({ endsAt: past }),
    promo({ usageLimit: 2, usedCount: 2 }),
  ]) {
    assert.equal(evaluatePromoCode(row, 100_000, now).valid, false);
  }
});

test("minimum order amount is checked against products before the discount", () => {
  const row = promo({ minOrderAmount: 100_000 });
  assert.equal(evaluatePromoCode(row, 99_999, now).valid, false);
  assert.equal(evaluatePromoCode(row, 100_000, now).valid, true);
});

test("a promo may not cover the whole products amount", () => {
  const evaluation = evaluatePromoCode(
    promo({ discountType: "fixed", discountValue: 100_000 }),
    100_000,
    now,
  );
  assert.equal(evaluation.valid, false);
  assert.match(evaluation.reason ?? "", /всю стоимость/);
});

test("receipt lines keep the exact discounted total", () => {
  const lines = discountedReceiptItems(
    [
      { name: "Шар", price: 10_001, quantity: 3 },
      { name: "Снежинка", price: 5_000, quantity: 2 },
    ],
    10_000,
  );
  const total = lines.reduce(
    (sum, line) => sum + line.amount * line.quantity,
    0,
  );
  assert.equal(total, 30_003);
  for (const line of lines) assert.ok(line.amount > 0);
});

test("receipt lines without a discount keep catalog prices", () => {
  assert.deepEqual(
    discountedReceiptItems([{ name: "Шар", price: 10_000, quantity: 2 }], 0),
    [{ name: "Шар", amount: 10_000, quantity: 2 }],
  );
});

test("receipt redistributes rounding remainder beyond the last line's capacity", () => {
  const lines = discountedReceiptItems(
    ["Шар", "Снежинка", "Домик", "Самовар"].map((name) => ({
      name,
      price: 1,
      quantity: 1,
    })),
    3,
  );
  assert.deepEqual(lines, [{ name: "Шар", amount: 1, quantity: 1 }]);
});
