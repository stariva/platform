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
  isMadeToOrderBuyable,
  MadeToOrderOptionsError,
  resolveCatalogItems,
  resolveMadeToOrderItems,
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

const sold: Product = { ...product, inStock: false, stockAvailable: 0 };
const toOrder = (overrides: Record<string, unknown> = {}) => ({
  productSlug: product.slug,
  quantity: 1,
  options: {
    size: "M",
    color: "Бежевый",
    measurements: [] as { label: string; value: string }[],
  },
  ...overrides,
});

test("made-to-order items need no stock or Ozon SKU, only price and the flag", async () => {
  catalog = {
    products: [{ ...sold, ozonSku: undefined }],
    status: "available",
  };

  const items = await resolveMadeToOrderItems([toOrder()]);

  assert.deepEqual(items, [
    {
      productSlug: product.slug,
      quantity: 1,
      name: "Туника",
      price: 350000,
      options: { size: "M", color: "Бежевый", measurements: [] },
    },
  ]);
});

test("made-to-order lines with different options stay separate", async () => {
  catalog = { products: [sold], status: "available" };

  const items = await resolveMadeToOrderItems([
    toOrder(),
    toOrder({ options: { size: "По меркам", color: "Как на фото" } }),
  ]);

  assert.equal(items.length, 2);
});

test("made-to-order rejects products that are not woven to order", async () => {
  catalog = {
    products: [{ ...sold, madeToOrder: false }],
    status: "available",
  };

  const error = await resolveMadeToOrderItems([toOrder()]).catch(
    (e: unknown) => e,
  );

  assert.ok(error instanceof CatalogItemsUnavailableError);
  assert.deepEqual(error.productSlugs, [product.slug]);
});

test("made-to-order rejects a size or color the product page does not offer", async () => {
  catalog = { products: [sold], status: "available" };

  for (const options of [
    { size: "XXXL", color: "Бежевый" },
    { size: "M", color: "Ядовито-зелёный" },
  ]) {
    const error = await resolveMadeToOrderItems([toOrder({ options })]).catch(
      (e: unknown) => e,
    );
    assert.ok(error instanceof MadeToOrderOptionsError);
  }
});

test("made-to-order accepts custom-size labels per category", async () => {
  catalog = {
    products: [sold, { ...sold, slug: "bag", category: "bags" }],
    status: "available",
  };

  const items = await resolveMadeToOrderItems([
    toOrder({ options: { size: "По меркам", color: "Молочный" } }),
    toOrder({
      productSlug: "bag",
      options: { size: "Свой размер", color: "Молочный" },
    }),
  ]);

  assert.equal(items.length, 2);
});

test("made-to-order caps the quantity of one line", async () => {
  catalog = { products: [sold], status: "available" };

  const error = await resolveMadeToOrderItems([
    toOrder({ quantity: 11 }),
  ]).catch((e: unknown) => e);

  assert.ok(error instanceof MadeToOrderOptionsError);
});

test("a product is orderable to measure with a RUB price and the flag", () => {
  assert.equal(isMadeToOrderBuyable(sold), true);
  assert.equal(isMadeToOrderBuyable(undefined), false);
  assert.equal(isMadeToOrderBuyable({ ...sold, madeToOrder: false }), false);
  assert.equal(isMadeToOrderBuyable({ ...sold, currency: "USD" }), false);
  assert.equal(isMadeToOrderBuyable({ ...sold, price: 0 }), false);
});
