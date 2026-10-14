import { mock, test } from "bun:test";
import assert from "node:assert/strict";

// Тест не должен зависеть от того, куда смотрит .env: без базы (как в CI)
// отзывов нет, а с боевой их число меняется. mock.module в bun глобален, но
// подмена ставится до тестов этого файла, а каждый файл ставит свою.
mock.module("@/lib/catalog/reviews-db", () => ({
  fetchPublishedReviews: async () => [
    {
      id: "r1",
      rating: 5,
      text: "Хороший отзыв",
      date: "2026-09-01T00:00:00.000Z",
      reviewerName: "Анна К.",
      productIds: [],
      photos: [],
      source: "ozon",
    },
  ],
}));

const { GET } = await import("./route");

test("rejects an explicitly empty offer ID", async () => {
  const response = await GET(
    new Request("https://example.com/api/ozon/reviews?offerId="),
  );

  assert.equal(response.status, 400);
});

test("omitting an offer ID keeps the store-wide snapshot available", async () => {
  const response = await GET(
    new Request("https://example.com/api/ozon/reviews"),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.total, 1);
  assert.equal(body.reviews[0].id, "r1");
});
