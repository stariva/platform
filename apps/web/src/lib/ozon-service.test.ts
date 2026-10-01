import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import type { Product, Review } from "./ozon-types";

const review = (overrides: Partial<Review>): Review => ({
  id: "r",
  rating: 5,
  text: "Хороший отзыв",
  date: "2026-09-01T00:00:00.000Z",
  reviewerName: "Анна К.",
  photos: [],
  source: "ozon",
  ...overrides,
});

const publishedReviews: Review[] = [
  review({
    id: "belt-old",
    productOfferId: "BELT_002",
    productTitle: "Пояс",
    date: "2026-08-01T00:00:00.000Z",
  }),
  review({
    id: "belt-new",
    productOfferId: "BELT_002",
    productTitle: "Пояс",
    rating: 3,
    date: "2026-09-01T00:00:00.000Z",
  }),
  review({
    id: "bag",
    productOfferId: "BAG_001",
    productTitle: "Сумка",
    photos: ["https://cdn.example/a.jpg"],
  }),
];
const fetchReviews = mock(async (): Promise<Review[]> => publishedReviews);
const fetchProducts = mock(async (): Promise<Product[] | null> => null);

mock.module("./catalog/products-db", () => ({
  fetchPublishedProducts: async () => {
    const products = await fetchProducts();
    if (products === null) throw new Error("db_unavailable");
    return products;
  },
}));
const scheduleStockSync = mock(() => {});
mock.module("./catalog/stock-sync", () => ({ scheduleStockSync }));
mock.module("./catalog/reviews-db", () => ({
  fetchPublishedReviews: fetchReviews,
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
  stockAvailable: 1,
  madeToOrder: true,
  ozonSku: 1234,
  material: "Хлопок",
};

test("catalog results distinguish an unavailable database from a successful empty catalog", async () => {
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

test("product reviews contain only that offer, newest first", async () => {
  const reviews = await getReviews({ offerId: "BELT_002" });
  assert.deepEqual(
    reviews.map((r) => r.id),
    ["belt-new", "belt-old"],
  );
  assert.deepEqual(await getReviews({ offerId: "unknown-offer" }), []);
});

test("store-wide reviews put photo reviews first and spread products", async () => {
  const reviews = await getReviews();
  assert.deepEqual(
    reviews.map((r) => r.id),
    ["bag", "belt-old", "belt-new"],
  );
});

test("rating summary uses the same set as displayed reviews", async () => {
  const reviews = await getReviews({ offerId: "BELT_002" });
  assert.deepEqual(await getRatingSummary("BELT_002"), {
    count: reviews.length,
    average: reviews.reduce((total, r) => total + r.rating, 0) / reviews.length,
  });
  assert.equal(await getRatingSummary("unknown-offer"), null);
});

test("stock sync is scheduled only after a successful catalog read", async () => {
  scheduleStockSync.mockClear();
  fetchProducts.mockResolvedValue(null);
  await getProductsResult();
  assert.equal(scheduleStockSync.mock.calls.length, 0);

  fetchProducts.mockResolvedValue([product]);
  await getProductsResult();
  assert.equal(scheduleStockSync.mock.calls.length, 1);
});
