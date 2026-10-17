import assert from "node:assert/strict";
import { test } from "node:test";
import { calculatePrice } from "@/lib/custom-order/pricing";
import {
  estimateOrder,
  itemsLeft,
  leadTime,
  MAX_ORDER_ITEMS,
  orderMessage,
} from "./order";

test("discount starts from five items", () => {
  const four = estimateOrder({
    colorId: "natural",
    quantities: { lampshade: 4 },
  });
  assert.equal(four.discountPercent, 0);
  assert.equal(four.discountedMin, Math.round(four.min / 100) * 100);
  const five = estimateOrder({
    colorId: "natural",
    quantities: { lampshade: 4, panel: 1 },
  });
  assert.equal(five.items, 5);
  assert.equal(five.discountPercent, 15);
});

test("estimate uses the shared price model with the item's size", () => {
  const unit = calculatePrice({
    productType: "panel",
    size: "l",
    color: "single",
    complexity: "standard",
  });
  assert.ok(unit);
  const estimate = estimateOrder({
    colorId: "single",
    quantities: { panel: 2 },
  });
  assert.equal(estimate.min, unit.min * 2);
  assert.equal(estimate.max, unit.max * 2);
});

test("limit counts every item type together", () => {
  assert.equal(
    itemsLeft({ colorId: "natural", quantities: { lampshade: 12, panel: 5 } }),
    MAX_ORDER_ITEMS - 17,
  );
  assert.equal(
    itemsLeft({ colorId: "natural", quantities: { lampshade: 25 } }),
    0,
  );
});

test("lead time grows with the order", () => {
  assert.equal(leadTime(1), "2–3 недели");
  assert.equal(leadTime(5), "2–3 недели");
  assert.equal(leadTime(12), "3–4 недели");
  assert.equal(leadTime(20), "4–6 недель");
});

test("message lists only chosen items and the place", () => {
  const message = orderMessage({
    colorId: "natural",
    place: "Кофейня / пекарня",
    city: " Казань ",
    quantities: { lampshade: 3, panel: 0 },
  });
  assert.match(message, /Место: Кофейня \/ пекарня, Казань/);
  assert.match(message, /1\. Абажур, .* — 3 шт\./);
  assert.doesNotMatch(message, /Панно/);
  assert.doesNotMatch(message, /скидкой/);
});
