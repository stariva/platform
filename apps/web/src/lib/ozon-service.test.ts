import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { OZON_REVIEWS } from "@/data/ozon-reviews";
import type { Product, Review } from "./ozon-types";

const snapshot = OZON_REVIEWS[0];
if (!snapshot?.productOfferId) throw new Error("Missing snapshot review");

const liveReviews: Review[] = [
  { ...snapshot, productSku: 1234, rating: 1 },
  { ...snapshot, id: "new-live-review", productSku: 1234, rating: 3 },
  { ...snapshot, id: "other-product", productSku: 5678, rating: 2 },
];
const fetchReviews = mock(async (_limit: number) => liveReviews);
const fetchProducts = mock(async (): Promise<Product[] | null> => null);

mock.module("./ozon/api-client", () => ({
  fetchFromOzon: fetchProducts,
  fetchOzonReviews: fetchReviews,
}));

const {
  getProducts,
  getProductsResult,
  getInStockProducts,
  getInStockProductsResult,
  getReviews,
  getRatingSummary,
} = await import("./ozon-service");

const product: Product = {
  id: "lamp-1",
  slug: "lamp-1",
  name: "Абажур",
  description: "",
  shortDescription: "",
  price: 20000,
  currency: "RUB",
  images: [],
  category: "interior",
  subcategory: "lampshades",
  inStock: true,
  ozonSku: 1234,
  material: "Хлопок",
};

test("catalog results distinguish unavailable Ozon from a successful empty catalog", async () => {
  for (const products of [null, []]) {
    fetchProducts.mockResolvedValue(products);
    const expected = {
      products: [],
      status: products === null ? "unavailable" : "available",
    };
    assert.deepEqual(await getProductsResult(), expected);
    assert.deepEqual(await getInStockProductsResult(), expected);
    assert.deepEqual(await getProducts(), []);
    assert.deepEqual(await getInStockProducts(), []);
  }
});

test("in-stock results filter purchasable products and retain catalog availability", async () => {
  const unavailableProducts = [
    { ...product, id: "sold-out", inStock: false },
    { ...product, id: "no-sku", ozonSku: undefined },
  ];
  const products = [product, ...unavailableProducts];
  fetchProducts.mockResolvedValue(products);
  assert.deepEqual(await getProductsResult(), {
    products,
    status: "available",
  });
  assert.deepEqual(await getProducts(), products);
  assert.deepEqual(await getInStockProductsResult(), {
    products: [product],
    status: "available",
  });
  assert.deepEqual(await getInStockProducts(), [product]);

  fetchProducts.mockResolvedValue(unavailableProducts);
  assert.deepEqual(await getInStockProductsResult(), {
    products: [],
    status: "available",
  });
});

test("product reviews filter the shared live request by SKU and deduplicate snapshot IDs", async () => {
  const reviews = await getReviews({
    offerId: snapshot.productOfferId,
    skus: [1234],
  });

  assert.deepEqual(fetchReviews.mock.lastCall, [100]);
  assert.equal(reviews.filter((review) => review.id === snapshot.id).length, 1);
  assert.equal(
    reviews.some((review) => review.id === "new-live-review"),
    true,
  );
  assert.equal(
    reviews.some((review) => review.id === "other-product"),
    false,
  );
  assert.equal(
    (await getReviews({ skus: [1234] })).some(
      (review) => review.id === "other-product",
    ),
    false,
  );

  assert.equal(
    (await getReviews()).some((review) => review.id === "other-product"),
    true,
  );
  assert.deepEqual(fetchReviews.mock.lastCall, [100]);
});

test("rating summary uses the same deduplicated set as displayed reviews", async () => {
  const reviews = await getReviews({
    offerId: snapshot.productOfferId,
    skus: [1234],
  });
  const summary = await getRatingSummary(snapshot.productOfferId, [1234]);

  assert.deepEqual(summary, {
    count: reviews.length,
    average:
      reviews.reduce((total, review) => total + review.rating, 0) /
      reviews.length,
  });
  assert.deepEqual(fetchReviews.mock.lastCall, [100]);
  assert.equal(await getRatingSummary("unknown-offer"), null);
});
