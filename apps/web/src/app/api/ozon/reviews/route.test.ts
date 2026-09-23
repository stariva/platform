import { test } from "bun:test";
import assert from "node:assert/strict";
import { GET } from "./route";

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
  assert.equal(body.total > 0, true);
});
