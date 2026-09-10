import { expect, test } from "bun:test";
import { resolveSiteUrl } from "./site-url";

test("production SEO never exposes a development host", () => {
  for (const value of [undefined, "http://localhost:3000", "http://127.0.0.1:3000", "https://preview.example/"]) {
    expect(resolveSiteUrl(value, true)).toBe("https://stariva.ru");
  }
});

test("development keeps its origin without paths or credentials", () => {
  expect(resolveSiteUrl("http://localhost:3000/", false)).toBe("http://localhost:3000");
  expect(() => resolveSiteUrl("javascript:alert(1)", false)).toThrow();
});
