import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProductRow } from "@stariva/db/schema";
import { productRowToProduct } from "./product-row";

const row: ProductRow = {
  id: "p-1",
  slug: "abazhur-makrame-4756",
  name: "Абажур макраме",
  description: "<p>Первый абзац</p><p>Второй абзац</p>",
  category: "interior",
  subcategory: "lampshades",
  status: "published",
  price: 3_000_000,
  oldPrice: null,
  images: ["https://cdn1.ozone.ru/a.jpg"],
  material: null,
  color: null,
  dimensions: null,
  careInstructions: null,
  sizes: [],
  madeToOrder: true,
  leadTimeMinDays: null,
  leadTimeMaxDays: null,
  ozonProductId: 1_234_567_890,
  ozonOfferId: "Lustra_002",
  ozonSku: 4_804_740_135,
  stockAvailable: 0,
  stockSyncedAt: null,
  featured: false,
  sortOrder: 0,
  seoTitle: null,
  seoDescription: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

test("converts kopecks to rubles and fills storefront defaults", () => {
  const product = productRowToProduct(row);
  assert.equal(product.price, 30_000);
  assert.equal(product.oldPrice, undefined);
  assert.equal(product.material, "100% хлопок");
  assert.equal(product.sizes, undefined);
  assert.equal(product.shortDescription, "Первый абзац. Второй абзац.");
  assert.equal(product.ozonUrl, "https://www.ozon.ru/product/4804740135");
  assert.equal(product.leadTimeDays, undefined);
});

test("is in stock only with free stock and a SKU for Ozon Delivery", () => {
  assert.equal(productRowToProduct(row).inStock, false);
  assert.equal(
    productRowToProduct({ ...row, stockAvailable: 2 }).inStock,
    true,
  );
  assert.equal(
    productRowToProduct({ ...row, stockAvailable: 2, ozonSku: null }).inStock,
    false,
  );
});

test("falls back to a placeholder image and exposes the lead time", () => {
  const product = productRowToProduct({
    ...row,
    images: [],
    leadTimeMinDays: 5,
    leadTimeMaxDays: 7,
  });
  assert.deepEqual(product.images, ["/images/catalog/placeholder.jpg"]);
  assert.deepEqual(product.leadTimeDays, { min: 5, max: 7 });
});
