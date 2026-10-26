import { expect, test } from "bun:test";
import { bundleExtraFor, bundleSlugs, getBundle } from "./bundles";

test("the tree combo sells both tree workshops, the small one first", () => {
  const bundle = getBundle("elka-makrame-kombo");
  expect(bundle?.priceKopecks).toBe(159_000);
  expect(bundle && bundleSlugs(bundle)).toEqual([
    "elka-makrame",
    "elka-makrame-bolshaya",
  ]);
  expect(getBundle("elka-makrame")).toBeUndefined();
  expect(getBundle(null)).toBeUndefined();
});

test("the second course promises its start date only until it opens", () => {
  const before = new Date("2026-10-26T12:00:00Z");
  const after = new Date("2026-11-03T08:00:00Z");
  expect(bundleExtraFor("elka-makrame-kombo", before)).toEqual({
    title: "мастер-класс по большой ёлке 75 × 150 см",
    releaseLabel: "3 ноября",
  });
  expect(bundleExtraFor("elka-makrame-kombo", after)?.releaseLabel).toBe(
    undefined,
  );
  expect(bundleExtraFor(null, before)).toBeUndefined();
});
