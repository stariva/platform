import { expect, test } from "bun:test";
import {
  MOBILE_APP_ORIGINS,
  trustedOriginsFor,
  withWwwVariants,
} from "./origins";

test("мобильные origin'ы — точные, без шаблонов и путей", () => {
  expect([...MOBILE_APP_ORIGINS].sort()).toEqual([
    "capacitor://localhost",
    "https://localhost",
  ]);
  for (const origin of MOBILE_APP_ORIGINS) {
    expect(origin).not.toContain("*");
    expect(origin.endsWith("/")).toBe(false);
  }
});

test("сайт доверяется вместе с www-парой, localhost — без неё", () => {
  expect(withWwwVariants(["https://stariva.ru"]).sort()).toEqual([
    "https://stariva.ru",
    "https://www.stariva.ru",
  ]);
  expect(withWwwVariants(["https://www.stariva.ru"]).sort()).toEqual([
    "https://stariva.ru",
    "https://www.stariva.ru",
  ]);
  expect(withWwwVariants(["http://localhost:3000"])).toEqual([
    "http://localhost:3000",
  ]);
});

test("trustedOrigins включает origin'ы приложения и не дублирует", () => {
  const origins = trustedOriginsFor(
    ["https://stariva.ru", "https://www.stariva.ru"],
    MOBILE_APP_ORIGINS,
  );
  expect(origins).toContain("https://stariva.ru");
  expect(origins).toContain("https://www.stariva.ru");
  expect(origins).toContain("https://localhost");
  expect(origins).toContain("capacitor://localhost");
  expect(new Set(origins).size).toBe(origins.length);
  expect(origins).not.toContain("*");
});

test("без extra приложение не доверяется (админка, другие потребители)", () => {
  const origins = trustedOriginsFor(["https://admin.stariva.ru"]);
  expect(origins).not.toContain("https://localhost");
  expect(origins).not.toContain("capacitor://localhost");
});

test("capacitor://localhost не ломает разбор адресов", () => {
  expect(withWwwVariants(["capacitor://localhost"])).toEqual([
    "capacitor://localhost",
  ]);
});
