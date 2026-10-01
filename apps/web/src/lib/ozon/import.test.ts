import assert from "node:assert/strict";
import { test } from "node:test";
import { dropDuplicateSlugs, ozonItemToProductRow } from "./import";
import type { OzonProductInfoV3 } from "./transformers";

const now = new Date("2026-10-01T12:00:00Z");

function info(overrides: Partial<OzonProductInfoV3> = {}): OzonProductInfoV3 {
  return {
    id: 123456789,
    offer_id: "lustra-01",
    name: "Абажур макраме",
    description: "Плетёный абажур",
    images: [],
    primary_image: "https://cdn1.ozone.ru/a.jpg",
    price: "3500",
    old_price: "4200",
    currency_code: "RUB",
    fbs_sku: 2_500_000_001,
    stocks: { stocks: [{ present: 3, reserved: 1 }] },
    ...overrides,
  };
}

test("keeps the storefront slug, category and price in kopecks", () => {
  const result = ozonItemToProductRow({ info: info() }, 10, now);
  assert.ok(result.ok);
  assert.equal(result.row.slug, "abazhur-makrame-6789");
  assert.equal(result.row.category, "interior");
  assert.equal(result.row.subcategory, "lampshades");
  assert.equal(result.row.price, 350_000);
  assert.equal(result.row.oldPrice, 420_000);
  assert.equal(result.row.sortOrder, 10);
  assert.deepEqual(result.row.images, ["https://cdn1.ozone.ru/a.jpg"]);
});

test("stores free FBS stock and a SKU above the int32 range", () => {
  const result = ozonItemToProductRow({ info: info() }, 0, now);
  assert.ok(result.ok);
  assert.equal(result.row.stockAvailable, 2);
  assert.equal(result.row.ozonSku, 2_500_000_001);
  assert.equal(result.row.stockSyncedAt, now);
});

test("never counts over-reserved stock as negative", () => {
  const result = ozonItemToProductRow(
    {
      info: info({
        stocks: {
          stocks: [
            { present: 1, reserved: 2 },
            { present: 2, reserved: 0 },
          ],
        },
      }),
    },
    0,
    now,
  );
  assert.ok(result.ok);
  assert.equal(result.row.stockAvailable, 2);
});

test("a product without SKU is imported as made-to-order only", () => {
  const result = ozonItemToProductRow(
    { info: info({ fbs_sku: undefined }) },
    0,
    now,
  );
  assert.ok(result.ok);
  assert.equal(result.row.ozonSku, null);
  assert.equal(result.row.stockAvailable, 0);
  assert.equal(result.row.madeToOrder, true);
});

test("drops the placeholder image and an old price not above the price", () => {
  const result = ozonItemToProductRow(
    { info: info({ primary_image: "", old_price: "" }) },
    0,
    now,
  );
  assert.ok(result.ok);
  assert.deepEqual(result.row.images, []);
  assert.equal(result.row.oldPrice, null);
});

test("skips a product with zero price", () => {
  const result = ozonItemToProductRow(
    { info: info({ price: "0", old_price: "" }) },
    0,
    now,
  );
  assert.equal(result.ok, false);
});

test("keeps the first product when two share a slug", () => {
  const first = ozonItemToProductRow({ info: info() }, 0, now);
  const second = ozonItemToProductRow(
    { info: info({ id: 999996789, offer_id: "lustra-02" }) },
    10,
    now,
  );
  const [a, b] = dropDuplicateSlugs([first, second]);
  assert.equal(a?.ok, true);
  assert.equal(b?.ok, false);
  assert.ok(b && !b.ok && b.reason.includes("lustra-01"));
});
