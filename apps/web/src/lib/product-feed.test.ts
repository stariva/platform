import assert from "node:assert/strict";
import { test } from "node:test";
import type { Product } from "./ozon-types";
import { productFeed, xmlEscape } from "./product-feed";

const product: Product = {
  id: "lamp-1",
  slug: "lamp-1",
  name: "Абажур & свет",
  description: "<Хлопок>",
  shortDescription: "",
  price: 20000,
  currency: "RUB",
  images: ["/images/catalog/category-interior.jpg"],
  category: "interior",
  subcategory: "lampshades",
  inStock: true,
  material: "Хлопок",
};

test("feed escapes seller data and uses rubles without a kopeck conversion", () => {
  const xml = productFeed([product]);
  assert.ok(xml.includes("<price>20000.00</price>"));
  assert.ok(xml.includes("Абажур &amp; свет"));
  assert.ok(xml.includes("&lt;Хлопок&gt;"));
  assert.ok(xml.includes("<currencyId>RUR</currencyId>"));
  assert.equal(xmlEscape('"\u0000<&'), "&quot;&lt;&amp;");
});

test("unavailable, unpriced and non-ruble products are not advertised", () => {
  for (const invalid of [
    { inStock: false },
    { price: NaN },
    { price: 0 },
    { currency: "USD" },
    { images: [] },
  ]) {
    assert.ok(
      !productFeed([{ ...product, ...invalid }]).includes("<offer id="),
    );
  }
});
