import { expect, test } from "bun:test";
import { ELKA_KIT_OWNER_PRICE_KOPECKS, elkaKitPrice } from "./elka-kit-price";

test("the owner price is the materials-only 990 ₽ for every kit color", () => {
  expect(ELKA_KIT_OWNER_PRICE_KOPECKS).toBe(99_000);
  for (const slug of [
    "nabor-makrame-elka",
    "nabor-makrame-elka-bezhevyy",
    "nabor-makrame-elka-shalfey",
  ]) {
    expect(elkaKitPrice(slug, 198_000, true)).toBe(99_000);
    expect(elkaKitPrice(slug, 198_000, false)).toBe(198_000);
  }
});

test("the discount never raises the catalog price", () => {
  expect(elkaKitPrice("nabor-makrame-elka", 50_000, true)).toBe(50_000);
  expect(elkaKitPrice("other-product", 198_000, true)).toBe(198_000);
});
