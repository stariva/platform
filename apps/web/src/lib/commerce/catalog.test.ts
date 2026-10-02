import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import type { ProductsResult } from "@/lib/ozon-service";
import type { Product } from "@/lib/ozon-types";

const product: Product = {
  id: "ozon-1",
  slug: "tunika-5565",
  name: "Туника",
  description: "",
  shortDescription: "",
  price: 3500,
  currency: "RUB",
  images: [],
  category: "clothes",
  subcategory: "tops",
  ozonSku: 3723160127,
  inStock: true,
  stockAvailable: 5,
  madeToOrder: true,
  material: "",
  featured: false,
};

let catalog: ProductsResult = { products: [], status: "available" };

mock.module("@/lib/ozon-service", () => ({
  getProductsResult: async () => catalog,
}));

const {
  CatalogItemsUnavailableError,
  isCatalogProductBuyable,
  resolveCatalogItems,
} = await import("./catalog");

test("resolves in-stock items with kopeck prices", async () => {
  catalog = { products: [product], status: "available" };

  const items = await resolveCatalogItems([
    { productSlug: product.slug, quantity: 1 },
    { productSlug: product.slug, quantity: 2 },
  ]);

  assert.deepEqual(items, [
    {
      productSlug: product.slug,
      quantity: 3,
      ozonSku: 3723160127,
      name: "Туника",
      price: 350000,
    },
  ]);
});

test("reports every sold-out or missing item at once", async () => {
  catalog = {
    products: [product, { ...product, slug: "sold-out", inStock: false }],
    status: "available",
  };

  const error = await resolveCatalogItems([
    { productSlug: product.slug, quantity: 1 },
    { productSlug: "sold-out", quantity: 1 },
    { productSlug: "delisted", quantity: 1 },
  ]).catch((e: unknown) => e);

  assert.ok(error instanceof CatalogItemsUnavailableError);
  assert.deepEqual(error.productSlugs, ["sold-out", "delisted"]);
});

test("rejects a quantity larger than the remaining stock", async () => {
  catalog = { products: [product], status: "available" };

  const error = await resolveCatalogItems([
    { productSlug: product.slug, quantity: 6 },
  ]).catch((e: unknown) => e);

  assert.ok(error instanceof CatalogItemsUnavailableError);
  assert.deepEqual(error.productSlugs, [product.slug]);
});

test("treats a catalog outage as a failure, not as sold-out items", async () => {
  catalog = { products: [], status: "unavailable" };

  const error = await resolveCatalogItems([
    { productSlug: product.slug, quantity: 1 },
  ]).catch((e: unknown) => e);

  assert.ok(error instanceof Error);
  assert.ok(!(error instanceof CatalogItemsUnavailableError));
  assert.equal(error.message, "catalog_unavailable");
});

test("a product is buyable only with stock, RUB price and an Ozon SKU", () => {
  assert.equal(isCatalogProductBuyable(product), true);
  assert.equal(isCatalogProductBuyable(undefined), false);
  assert.equal(isCatalogProductBuyable({ ...product, inStock: false }), false);
  assert.equal(
    isCatalogProductBuyable({ ...product, stockAvailable: 0 }),
    false,
  );
  assert.equal(
    isCatalogProductBuyable({ ...product, ozonSku: undefined }),
    false,
  );
  assert.equal(isCatalogProductBuyable({ ...product, currency: "USD" }), false);
  assert.equal(isCatalogProductBuyable({ ...product, price: 0 }), false);
});
