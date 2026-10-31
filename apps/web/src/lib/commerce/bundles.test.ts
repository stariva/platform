import { expect, test } from "bun:test";
import {
  applyBundlePricing,
  bundleSavingKopecks,
  GNOME_PAIR_PRICE_KOPECKS,
} from "./bundles";

const pumpkin = { productSlug: "gnom-tykva-9563", quantity: 1, price: 370_000 };
const flyAgaric = {
  productSlug: "gnom-mukhomor-0554",
  quantity: 1,
  price: 370_000,
};
const other = { productSlug: "elka-1234", quantity: 1, price: 120_000 };

const total = (items: { price: number; quantity: number }[]) =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);

test("both gnomes together cost the pair price to the kopeck", () => {
  const priced = applyBundlePricing([pumpkin, other, flyAgaric]);
  expect(total(priced.filter((i) => i !== priced[1]))).toBe(
    GNOME_PAIR_PRICE_KOPECKS,
  );
  expect(priced[1]).toBe(other);
  expect(priced[0]?.price).toBe(325_000);
  expect(priced[0]?.listPrice).toBe(370_000);
  expect(bundleSavingKopecks(priced)).toBe(90_000);
});

test("an odd discount is split without losing a kopeck", () => {
  const priced = applyBundlePricing([
    { ...pumpkin, price: 370_001 },
    flyAgaric,
  ]);
  expect(total(priced)).toBe(GNOME_PAIR_PRICE_KOPECKS);
});

test("the discount follows the prices, so a cheap gnome never goes negative", () => {
  const priced = applyBundlePricing([
    { ...pumpkin, price: 100_000 },
    { ...flyAgaric, price: 800_000 },
  ]);
  expect(total(priced)).toBe(GNOME_PAIR_PRICE_KOPECKS);
  for (const item of priced) expect(item.price).toBeGreaterThan(0);

  const extreme = applyBundlePricing([
    { ...pumpkin, price: 1 },
    { ...flyAgaric, price: 700_000 },
  ]);
  expect(total(extreme)).toBe(GNOME_PAIR_PRICE_KOPECKS);
  for (const item of extreme) expect(item.price).toBeGreaterThan(0);
});

test("a single gnome is sold at the catalog price", () => {
  expect(applyBundlePricing([pumpkin, other])).toEqual([pumpkin, other]);
  expect(applyBundlePricing([flyAgaric])).toEqual([flyAgaric]);
});

test("no discount when the pair would not be cheaper", () => {
  const cheap = [
    { ...pumpkin, price: 300_000 },
    { ...flyAgaric, price: 300_000 },
  ];
  expect(applyBundlePricing(cheap)).toEqual(cheap);
});

test("made-to-order gnomes and several pieces are left alone", () => {
  const madeToOrder = [
    { ...pumpkin, fulfillmentType: "made_to_order" as const },
    flyAgaric,
  ];
  expect(applyBundlePricing(madeToOrder)).toEqual(madeToOrder);
  const two = [{ ...pumpkin, quantity: 2 }, flyAgaric];
  expect(applyBundlePricing(two)).toEqual(two);
});

test("input items are not mutated", () => {
  const items = [{ ...pumpkin }, { ...flyAgaric }];
  applyBundlePricing(items);
  expect(items[0]?.price).toBe(370_000);
});
