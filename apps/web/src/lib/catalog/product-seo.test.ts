import assert from "node:assert/strict";
import { test } from "node:test";
import type { Product } from "@/lib/ozon-types";
import { productMetaDescription, productMetaTitle } from "./product-seo";

const product = {
  name: "Туника макраме, бежевая",
  shortDescription: "Лёгкая туника из хлопкового шнура.",
} as Product;

test("prefers the SEO fields written in the admin", () => {
  const custom = {
    ...product,
    seoTitle: "Туника, купить",
    seoDescription: "Свой текст.",
  };
  assert.equal(productMetaTitle(custom), "Туника, купить");
  assert.equal(productMetaDescription(custom), "Свой текст.");
});

test("falls back to the name and the lead without the brand", () => {
  assert.equal(productMetaTitle(product), "Туника макраме, бежевая, купить");
  assert.equal(
    productMetaDescription(product),
    "Лёгкая туника из хлопкового шнура. Ручная работа, доставка по России.",
  );
});

test("keeps the fallback description snippet-sized", () => {
  const long = { ...product, shortDescription: "слово ".repeat(60).trim() };
  const description = productMetaDescription(long);
  assert.ok(description.length <= 160);
  assert.ok(description.endsWith("…"));
});
