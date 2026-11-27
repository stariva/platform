import { test } from "bun:test";
import assert from "node:assert/strict";
import type { Product } from "./catalog/types";
import {
  groupNewYearProducts,
  isNewYearSubcategory,
  newYearProductImage,
  ornamentImage,
} from "./new-year";

const product = (overrides: Partial<Product>): Product => ({
  id: "product-1",
  slug: "product-1",
  name: "Товар",
  description: "",
  shortDescription: "",
  price: 1000,
  currency: "RUB",
  images: ["https://cdn.stariva.ru/products/photo.jpg"],
  category: "interior",
  subcategory: "planters",
  inStock: true,
  stockAvailable: 3,
  madeToOrder: false,
  ozonSku: 123456,
  material: "PLA",
  ...overrides,
});

test("new year grouping uses database subcategories for arbitrary product slugs", () => {
  const ornament = product({
    id: "bell",
    slug: "kolokolchik-red",
    subcategory: "ornaments",
  });
  const set = product({
    id: "set",
    slug: "novogodniy-nabor-mini",
    subcategory: "ornament_sets",
  });
  const box = product({
    id: "box",
    slug: "podarochnaya-korobka-snezhinka",
    subcategory: "gift_boxes",
  });
  const other = product({
    id: "other",
    slug: "kashpo",
    subcategory: "planters",
  });

  assert.deepEqual(groupNewYearProducts([ornament, set, box, other]), {
    ornaments: [ornament],
    sets: [set],
    boxes: [box],
  });
});

test("new year grouping keeps legacy slugs working while products are recategorized", () => {
  const ornament = product({
    id: "legacy-ornament",
    slug: "novogodnee-ukrashenie-bell",
  });
  const set = product({
    id: "legacy-set",
    slug: "novogodniy-nabor-zimniy-uyut",
  });
  const box = product({
    id: "legacy-box",
    slug: "novogodnyaya-podarochnaya-korobka",
  });
  const other = product({ id: "other", slug: "dizainerskoe-kashpo" });

  const groups = groupNewYearProducts([ornament, set, box, other]);
  assert.deepEqual(groups.ornaments, [ornament]);
  assert.deepEqual(groups.sets, [set]);
  assert.deepEqual(groups.boxes, [box]);
});

test("new year image prefers the database photo and uses collection art only as a placeholder fallback", () => {
  const withPhoto = product({ slug: "novogodnee-ukrashenie-bell" });
  assert.equal(newYearProductImage(withPhoto), withPhoto.images[0]);

  const withoutPhoto = product({
    slug: "novogodnee-ukrashenie-bell",
    images: ["https://cdn.stariva.ru/site/images/catalog/placeholder.jpg"],
  });
  assert.equal(newYearProductImage(withoutPhoto), ornamentImage("bell"));
});

test("seasonal subcategories are recognized for catalog routing", () => {
  assert.equal(isNewYearSubcategory("ornaments"), true);
  assert.equal(isNewYearSubcategory("ornament_sets"), true);
  assert.equal(isNewYearSubcategory("gift_boxes"), true);
  assert.equal(isNewYearSubcategory("planters"), false);
});
