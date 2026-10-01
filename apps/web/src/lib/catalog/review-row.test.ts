import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReviewRow } from "@stariva/db/schema";
import { reviewRowToReview } from "./review-row";

const row: ReviewRow = {
  id: "r-1",
  source: "ozon",
  rating: 5,
  text: "Красивая вещь",
  reviewerName: "Галина П.",
  productOfferId: "BELT_003",
  productTitle: "Пояс",
  photos: ["https://cdn.example/1.jpg", "https://cdn.example/2.jpg"],
  reviewedAt: new Date("2026-09-03T17:30:58Z"),
  published: true,
  showPhotos: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

test("maps a row to a storefront review", () => {
  assert.deepEqual(reviewRowToReview(row, ["product-1"]), {
    id: "r-1",
    rating: 5,
    text: "Красивая вещь",
    date: "2026-09-03T17:30:58.000Z",
    reviewerName: "Галина П.",
    productOfferId: "BELT_003",
    productTitle: "Пояс",
    productIds: ["product-1"],
    photos: row.photos,
    source: "ozon",
  });
});

test("a review without links belongs to no product", () => {
  assert.deepEqual(reviewRowToReview(row).productIds, []);
});

test("hidden photos never reach the storefront", () => {
  assert.deepEqual(reviewRowToReview({ ...row, showPhotos: false }).photos, []);
});

test("a review without a product has no offer id", () => {
  const review = reviewRowToReview({
    ...row,
    productOfferId: null,
    productTitle: null,
  });
  assert.equal(review.productOfferId, undefined);
  assert.equal(review.productTitle, undefined);
});
