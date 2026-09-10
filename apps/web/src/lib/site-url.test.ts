import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSiteUrl } from "./site-url";

test("production SEO never exposes a development host", () => {
  for (const value of [
    undefined,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://preview.example/",
  ]) {
    assert.equal(resolveSiteUrl(value, true), "https://stariva.ru");
  }
});

test("development keeps its origin without paths or credentials", () => {
  assert.equal(
    resolveSiteUrl("http://localhost:3000/", false),
    "http://localhost:3000",
  );
  assert.throws(() => resolveSiteUrl("javascript:alert(1)", false));
});
