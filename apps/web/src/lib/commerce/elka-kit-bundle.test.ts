import { expect, test } from "bun:test";
import {
  kitBundleBaseTotal,
  kitBundleTotal,
  kitBundleUnitPrice,
  priceKitBundleLines,
  resolveKitOrderGift,
} from "./elka-kit-bundle";

const beige = {
  productSlug: "nabor-makrame-elka-bezhevyy",
  price: 198_000,
  quantity: 1,
};
const sage = {
  productSlug: "nabor-makrame-elka-shalfey",
  price: 198_000,
  quantity: 1,
};
const khaki = {
  productSlug: "nabor-makrame-elka",
  price: 198_000,
  quantity: 1,
};

test("kit bundles allocate exact checkout totals for mixed and repeated colors", () => {
  for (const [lines, mode, expected] of [
    [[beige, sage], "single_lesson", 279_000],
    [[beige, sage], "separate_gifts", 378_000],
    [[beige, sage, khaki], "single_lesson", 342_000],
    [[{ ...khaki, quantity: 3 }], "separate_gifts", 540_000],
  ] as const) {
    const priced = priceKitBundleLines([...lines], mode);
    expect(
      priced?.reduce((sum, item) => sum + item.price * item.quantity, 0),
    ).toBe(expected);
  }
});

test("the lesson is paid in full; the discount applies to materials only", () => {
  for (const [count, mode, total, base] of [
    [2, "single_lesson", 279_000, 297_000],
    [2, "separate_gifts", 378_000, 396_000],
    [3, "single_lesson", 342_000, 396_000],
    [3, "separate_gifts", 540_000, 594_000],
  ] as const) {
    expect(kitBundleTotal(count, mode)).toBe(total);
    expect(kitBundleBaseTotal(count, mode)).toBe(base);
    // Скидка на материалы: 90 ₽ с комплекта за два набора, 180 ₽ за три
    expect(base - total).toBe((count === 2 ? 9_000 : 18_000) * count);
    expect(kitBundleUnitPrice(count, mode)).toBe(total / count);
  }
  expect(kitBundleTotal(1, "single_lesson")).toBeNull();
  expect(kitBundleBaseTotal(1, "separate_gifts")).toBeNull();
  expect(kitBundleUnitPrice(4, "single_lesson")).toBeNull();
});

test("kit pricing rejects unrelated products and invalid quantities", () => {
  expect(
    priceKitBundleLines(
      [beige, { ...sage, productSlug: "other" }],
      "single_lesson",
    ),
  ).toBeNull();
  expect(priceKitBundleLines([beige], "single_lesson")).toBeNull();
  expect(
    priceKitBundleLines([{ ...khaki, quantity: 4 }], "single_lesson"),
  ).toBeNull();
  expect(
    priceKitBundleLines(
      [{ ...khaki, quantity: 2, price: 100_000 }],
      "single_lesson",
    ),
  ).toBeNull();
});

test("the bundle mode overrides a stored gift choice without changing ordinary checkout", () => {
  expect(resolveKitOrderGift("single_lesson", true)).toBe(false);
  expect(resolveKitOrderGift("separate_gifts", false)).toBe(true);
  expect(resolveKitOrderGift(undefined, true)).toBe(true);
  expect(resolveKitOrderGift(undefined, false)).toBe(false);
  expect(resolveKitOrderGift(undefined)).toBeUndefined();
});
