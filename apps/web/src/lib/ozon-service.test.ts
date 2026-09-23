import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { OZON_REVIEWS } from "@/data/ozon-reviews";
import type { Review } from "./ozon-types";

const snapshot = OZON_REVIEWS[0];
if (!snapshot?.productOfferId) throw new Error("Missing snapshot review");

const liveReviews: Review[] = [
  { ...snapshot, productSku: 1234, rating: 1 },
  { ...snapshot, id: "new-live-review", productSku: 1234, rating: 3 },
  { ...snapshot, id: "other-product", productSku: 5678, rating: 2 },
];
const fetchReviews = mock(
  async (_limit: number, _skus?: number[]) => liveReviews,
);

mock.module("./ozon/api-client", () => ({
  fetchFromOzon: async () => null,
  fetchOzonReviews: fetchReviews,
}));

const { getReviews, getRatingSummary } = await import("./ozon-service");

test("product reviews filter the live request by SKU and deduplicate snapshot IDs", async () => {
  const reviews = await getReviews({
    offerId: snapshot.productOfferId,
    skus: [1234],
  });

  assert.deepEqual(fetchReviews.mock.lastCall, [100, [1234]]);
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
  assert.deepEqual(fetchReviews.mock.lastCall, [100, undefined]);
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
  assert.deepEqual(fetchReviews.mock.lastCall, [100, [1234]]);
  assert.equal(await getRatingSummary("unknown-offer"), null);
});
