import { expect, test } from "bun:test";
import { priceKitBundleLines } from "./elka-kit-bundle";

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
    [[beige, sage], "single_lesson", 333_000],
    [[beige, sage], "separate_gifts", 378_000],
    [[beige, sage, khaki], "single_lesson", 468_000],
    [[{ ...khaki, quantity: 3 }], "separate_gifts", 540_000],
  ] as const) {
    const priced = priceKitBundleLines([...lines], mode);
    expect(
      priced?.reduce((sum, item) => sum + item.price * item.quantity, 0),
    ).toBe(expected);
  }
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
