import { expect, test } from "bun:test";
import { cartLineKey } from "./cart-context";

test("instant and custom made-to-order lines of the same product stay separate", () => {
  const base = {
    productSlug: "novogodnee-ukrashenie-shar",
    fulfillmentType: "made_to_order" as const,
    options: { size: "Как на фото", color: "Как на фото", measurements: [] },
  };

  expect(cartLineKey({ ...base, instantMadeToOrder: true })).toBe(
    "instant:novogodnee-ukrashenie-shar:Как на фото:Как на фото",
  );
  expect(cartLineKey(base)).toBe(
    "made_to_order:novogodnee-ukrashenie-shar:Как на фото:Как на фото",
  );
});
