import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getProductMadeToOrder,
  MADE_TO_ORDER_DAYS,
  madeToOrderLeadTime,
} from "./made-to-order";

test("lead time falls back to the shared term and declines days", () => {
  assert.equal(madeToOrderLeadTime({}), MADE_TO_ORDER_DAYS);
  assert.equal(
    madeToOrderLeadTime({ leadTimeDays: { min: 2, max: 4 } }),
    "2–4 дня",
  );
  assert.equal(
    madeToOrderLeadTime({ leadTimeDays: { min: 5, max: 7 } }),
    "5–7 дней",
  );
  assert.equal(
    madeToOrderLeadTime({ leadTimeDays: { min: 1, max: 1 } }),
    "1 день",
  );
  assert.equal(
    madeToOrderLeadTime({ leadTimeDays: { min: 10, max: 14 } }),
    "10–14 дней",
  );
  assert.equal(
    madeToOrderLeadTime({ leadTimeDays: { min: 14, max: 21 } }),
    "14–21 день",
  );
});

test("made-to-order config is offered only for made-to-order products", () => {
  assert.ok(getProductMadeToOrder({ category: "bags", madeToOrder: true }));
  assert.equal(
    getProductMadeToOrder({ category: "bags", madeToOrder: false }),
    null,
  );
});
