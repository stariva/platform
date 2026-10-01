import assert from "node:assert/strict";
import { test } from "node:test";
import type { Review } from "./ozon-types";
import {
  pageWindow,
  paginateReviews,
  parseReviewsQuery,
  reviewsHref,
} from "./reviews-listing";

function review(id: string, rating: number, photos: string[] = []): Review {
  return {
    id,
    rating,
    text: "Текст",
    date: "2026-09-03T17:30:58.000Z",
    reviewerName: "Галина П.",
    photos,
    source: "ozon",
  };
}

test("parses valid query params and drops garbage", () => {
  assert.deepEqual(parseReviewsQuery({ photos: "1", rating: "5", page: "3" }), {
    photos: true,
    rating: 5,
    page: 3,
  });
  assert.deepEqual(
    parseReviewsQuery({ photos: "yes", rating: "9", page: "-2" }),
    { photos: false, rating: undefined, page: 1 },
  );
  assert.deepEqual(parseReviewsQuery({ rating: ["4", "5"], page: "abc" }), {
    photos: false,
    rating: 4,
    page: 1,
  });
});

test("builds hrefs without default values", () => {
  assert.equal(reviewsHref({}), "/reviews");
  assert.equal(reviewsHref({ page: 1 }), "/reviews");
  assert.equal(
    reviewsHref({ photos: true, rating: 5, page: 2 }),
    "/reviews?photos=1&rating=5&page=2",
  );
});

test("filters by photo and rating, then paginates", () => {
  const all = [
    review("a", 5, ["p"]),
    review("b", 5),
    review("c", 4, ["p"]),
    review("d", 5, ["p"]),
  ];
  const withPhotos = paginateReviews(all, { photos: true, page: 1 }, 2);
  assert.equal(withPhotos.total, 3);
  assert.equal(withPhotos.pageCount, 2);
  assert.deepEqual(
    withPhotos.reviews.map((r) => r.id),
    ["a", "c"],
  );

  const fiveStarPhotos = paginateReviews(
    all,
    { photos: true, rating: 5, page: 1 },
    2,
  );
  assert.deepEqual(
    fiveStarPhotos.reviews.map((r) => r.id),
    ["a", "d"],
  );
});

test("clamps an out-of-range page and handles empty results", () => {
  const all = [review("a", 5), review("b", 5), review("c", 5)];
  const clamped = paginateReviews(all, { photos: false, page: 99 }, 2);
  assert.equal(clamped.page, 2);
  assert.deepEqual(
    clamped.reviews.map((r) => r.id),
    ["c"],
  );

  const empty = paginateReviews(all, { photos: false, rating: 1, page: 1 }, 2);
  assert.equal(empty.total, 0);
  assert.equal(empty.pageCount, 1);
  assert.deepEqual(empty.reviews, []);
});

test("builds a compact page window with gaps", () => {
  assert.deepEqual(pageWindow(1, 3), [1, 2, 3]);
  assert.deepEqual(pageWindow(5, 10), [1, null, 4, 5, 6, null, 10]);
  assert.deepEqual(pageWindow(2, 10), [1, 2, 3, null, 10]);
  assert.deepEqual(pageWindow(1, 1), [1]);
});
