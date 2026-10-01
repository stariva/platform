import { describe, expect, test } from "bun:test";
import {
  type ProductFormValues,
  productFormSchema,
  productSlugFromName,
} from "./product";

const valid: ProductFormValues = {
  name: "Абажур макраме",
  slug: "abazhur-makrame-4756",
  description: "<p>Описание</p>",
  category: "interior",
  subcategory: "lampshades",
  status: "published",
  price: 30_000,
  oldPrice: 35_000,
  images: ["https://storage.yandexcloud.net/stariva-public/products/a.jpg"],
  material: "100% хлопок",
  color: "",
  dimensions: "",
  careInstructions: "",
  sizes: [],
  madeToOrder: true,
  leadTimeMinDays: null,
  leadTimeMaxDays: null,
  featured: false,
  sortOrder: 0,
  seoTitle: "",
  seoDescription: "",
};

const errorPaths = (value: ProductFormValues) => {
  const result = productFormSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
};

describe("productFormSchema", () => {
  test("accepts a valid product", () => {
    expect(errorPaths(valid)).toEqual([]);
  });

  test("rejects a subcategory from another category", () => {
    expect(errorPaths({ ...valid, subcategory: "belts" })).toEqual([
      "subcategory",
    ]);
  });

  test("old price must exceed the price", () => {
    expect(errorPaths({ ...valid, oldPrice: 30_000 })).toEqual(["oldPrice"]);
    expect(errorPaths({ ...valid, oldPrice: null })).toEqual([]);
  });

  test("lead time needs both bounds in order", () => {
    expect(errorPaths({ ...valid, leadTimeMinDays: 5 })).toEqual([
      "leadTimeMaxDays",
    ]);
    expect(
      errorPaths({ ...valid, leadTimeMinDays: 7, leadTimeMaxDays: 5 }),
    ).toEqual(["leadTimeMaxDays"]);
    expect(
      errorPaths({ ...valid, leadTimeMinDays: 5, leadTimeMaxDays: 7 }),
    ).toEqual([]);
  });

  test("slug is lowercase latin with single dashes", () => {
    expect(errorPaths({ ...valid, slug: "Абажур" })).toEqual(["slug"]);
    expect(errorPaths({ ...valid, slug: "a--b" })).toEqual(["slug"]);
  });
});

describe("productSlugFromName", () => {
  test("transliterates Russian names", () => {
    expect(productSlugFromName("Абажур макраме (без патрона), 1 шт")).toBe(
      "abazhur-makrame-bez-patrona-1-sht",
    );
    expect(productSlugFromName("Ёлка-панно «Щука»")).toBe("elka-panno-shchuka");
  });
});
