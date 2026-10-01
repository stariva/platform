import { test } from "bun:test";
import assert from "node:assert/strict";
import { ratingSourcesLabel } from "./ratings";

test("names the marketplaces the ratings come from", () => {
  assert.equal(ratingSourcesLabel(["ozon"]), "на Ozon");
  assert.equal(ratingSourcesLabel(["ozon", "avito"]), "на Ozon и Авито");
  assert.equal(ratingSourcesLabel(["avito", "site"]), "на Авито");
  assert.equal(ratingSourcesLabel(["site"]), "");
});
