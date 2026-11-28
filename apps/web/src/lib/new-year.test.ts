import { test } from "bun:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import type { Product } from "./catalog/types";
import {
  groupNewYearProducts,
  isNewYearProductPurchasable,
  isNewYearSubcategory,
  newYearDisplayName,
  newYearFigurinesPerItem,
  newYearProductImage,
  newYearSetContents,
  newYearSetMerchandising,
  newYearSubcategoryFor,
  ornamentImage,
  ornamentSlug,
  ornaments,
  pluralGiftBoxes,
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
    id: "shar",
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
    slug: "novogodnee-ukrashenie-shar",
  });
  const set = product({
    id: "legacy-set",
    slug: "novogodniy-nabor-zimniy-uyut",
  });
  const box = product({
    id: "legacy-box",
    slug: "novogodnyaya-podarochnaya-korobka",
  });
  const other = product({
    id: "other",
    slug: "novogodnyaya-podarochnaya-korobka-kashpo",
  });
  const products = [ornament, set, box, other];

  const groups = groupNewYearProducts(products);
  assert.deepEqual(groups.ornaments, [ornament]);
  assert.deepEqual(groups.sets, [set]);
  assert.deepEqual(groups.boxes, [box]);
  assert.deepEqual(
    products.filter((p) => !newYearSubcategoryFor(p)),
    [other],
  );
});

test("new year image prefers the database photo and uses collection art only as a placeholder fallback", () => {
  const withPhoto = product({ slug: "novogodnee-ukrashenie-shar" });
  assert.equal(newYearProductImage(withPhoto), withPhoto.images[0]);

  const withoutPhoto = product({
    slug: "novogodnee-ukrashenie-shar",
    images: ["https://cdn.stariva.ru/site/images/catalog/placeholder.jpg"],
  });
  assert.equal(newYearProductImage(withoutPhoto), ornamentImage("shar"));

  const snowflakeWithoutPhoto = product({
    slug: "novogodnee-ukrashenie-snowflake",
    images: ["https://cdn.stariva.ru/site/images/catalog/placeholder.jpg"],
  });
  assert.equal(
    newYearProductImage(snowflakeWithoutPhoto),
    ornamentImage("snowflake"),
  );
});

test("ornament fallback art uses files that exist for every collection item", () => {
  for (const ornament of ornaments) {
    const image = ornamentImage(ornament.id);
    assert.equal(
      newYearProductImage(
        product({ slug: ornamentSlug(ornament.id), images: [] }),
      ),
      image,
    );
    const file = image.replace("/images/new-year/", "");
    assert.equal(
      existsSync(
        new URL(`../../public/images/new-year/${file}`, import.meta.url),
      ),
      true,
      ornament.id,
    );
  }
  assert.equal(ornamentImage("house"), "/images/new-year/house.svg");
  assert.equal(ornamentImage("samovar"), "/images/new-year/samovar.svg");
  assert.equal(ornamentImage("matryoshka"), "/images/new-year/ornament.svg");
  assert.equal(ornamentImage("loshadka"), "/images/new-year/ornament.svg");
});

test("new year set merchandising resolves composition and honest separate-price savings", () => {
  const ids = [
    "snowflake",
    "varezhka",
    "bell",
    "star",
    "house",
    "samovar",
    "bublik",
  ] as const;
  const ornaments = ids.map((id) =>
    product({ slug: ornamentSlug(id), price: 990 }),
  );
  const set = product({
    slug: "novogodniy-nabor-zimniy-uyut",
    price: 1100,
  });

  const merchandising = newYearSetMerchandising(set, ornaments);

  assert.deepEqual(
    merchandising.items.map((item) => item.id),
    [...ids],
  );
  assert.equal(merchandising.items[0]?.product, ornaments[0]);
  assert.equal(merchandising.separateTotal, 6930);
  assert.equal(merchandising.savings, 5830);
});

test("new year set merchandising hides comparison when composition pricing is incomplete", () => {
  const set = product({
    slug: "novogodniy-nabor-zimniy-uyut",
    price: 1100,
  });
  const incomplete = [product({ slug: ornamentSlug("snowflake"), price: 990 })];

  const merchandising = newYearSetMerchandising(set, incomplete);

  assert.equal(merchandising.items.length, 7);
  assert.equal(merchandising.separateTotal, undefined);
  assert.equal(merchandising.savings, undefined);
  assert.deepEqual(
    newYearSetMerchandising(set, []).definition?.name,
    "Зимний уют",
  );
  assert.equal(
    newYearSetMerchandising(product({ slug: "unknown-set" }), []).items.length,
    0,
  );
});

test("skazochniy terem set spans the whole collection with honest savings", () => {
  const ornamentProducts = ornaments.map((item) =>
    product({ slug: ornamentSlug(item.id), price: 150 }),
  );
  const set = product({
    slug: "novogodniy-nabor-skazochniy-terem",
    price: 1620,
  });

  const merchandising = newYearSetMerchandising(set, ornamentProducts);

  assert.equal(merchandising.definition?.name, "Сказочный терем");
  assert.equal(merchandising.items.length, 15);
  assert.equal(merchandising.separateTotal, 2250);
  assert.equal(merchandising.savings, 630);
  assert.deepEqual(
    newYearSetContents("novogodniy-nabor-skazochniy-terem").length,
    15,
  );
  assert.equal(
    newYearFigurinesPerItem("novogodniy-nabor-skazochniy-terem"),
    15,
  );
});

test("pluralGiftBoxes uses correct Russian box forms", () => {
  assert.equal(pluralGiftBoxes(1), "футляр");
  assert.equal(pluralGiftBoxes(2), "футляра");
  assert.equal(pluralGiftBoxes(3), "футляра");
  assert.equal(pluralGiftBoxes(5), "футляров");
  assert.equal(pluralGiftBoxes(11), "футляров");
  assert.equal(pluralGiftBoxes(21), "футляр");
});

test("seasonal subcategories are recognized for catalog routing", () => {
  assert.equal(isNewYearSubcategory("ornaments"), true);
  assert.equal(isNewYearSubcategory("ornament_sets"), true);
  assert.equal(isNewYearSubcategory("gift_boxes"), true);
  assert.equal(isNewYearSubcategory("planters"), false);
});

test("newYearDisplayName strips redundant prefix and uses canonical collection names", () => {
  assert.equal(
    newYearDisplayName({
      slug: "novogodnee-ukrashenie-shar",
      name: "Новогоднее украшение «Ёлочный шар»",
    }),
    "Ёлочный шар",
  );
  assert.equal(
    newYearDisplayName({
      slug: "novogodniy-nabor-zimniy-uyut",
      name: "Новогодний набор «Зимний уют»",
    }),
    "Набор «Зимний уют»",
  );
  assert.equal(
    newYearDisplayName({
      slug: "custom-ornament-slug",
      name: "Новогоднее украшение «Снегирь»",
    }),
    "Снегирь",
  );
});

test("isNewYearProductPurchasable checks madeToOrder RUB pricing", () => {
  assert.equal(
    isNewYearProductPurchasable(
      product({ madeToOrder: true, price: 150, currency: "RUB" }),
    ),
    true,
  );
  assert.equal(
    isNewYearProductPurchasable(
      product({ madeToOrder: false, price: 150, currency: "RUB" }),
    ),
    false,
  );
  assert.equal(isNewYearProductPurchasable(undefined), false);
});
