import assert from "node:assert/strict";
import { test } from "node:test";
import { calculatePrice } from "@/lib/custom-order/pricing";
import {
  type Brief,
  briefMessage,
  designerDiscount,
  estimateBrief,
  MAX_ITEM_QUANTITY,
} from "./brief";

const brief = (overrides: Partial<Brief> = {}): Brief => ({
  colorId: "natural",
  items: [],
  ...overrides,
});

test("designer discount starts from the first item and grows from five", () => {
  assert.equal(designerDiscount(0), 0);
  assert.equal(designerDiscount(1), 10);
  assert.equal(designerDiscount(4), 10);
  assert.equal(designerDiscount(5), 15);
  assert.equal(designerDiscount(40), 15);
});

test("estimate multiplies the shared price model by quantity", () => {
  const unit = calculatePrice({
    productType: "lampshade",
    size: "m",
    color: "single",
    complexity: "standard",
  });
  assert.ok(unit);
  const estimate = estimateBrief(
    brief({
      colorId: "single",
      items: [{ typeId: "lampshade", sizeId: "m", quantity: 6 }],
    }),
  );
  assert.equal(estimate.items, 6);
  assert.equal(estimate.min, unit.min * 6);
  assert.equal(estimate.max, unit.max * 6);
  assert.equal(estimate.discountPercent, 15);
  assert.equal(
    estimate.discountedMin,
    Math.round((unit.min * 6 * 0.85) / 100) * 100,
  );
});

test("items without a price model count toward discount but not the sum", () => {
  const estimate = estimateBrief(
    brief({
      items: [
        { typeId: "screen", sizeId: "xl", quantity: 2 },
        { typeId: "panel", sizeId: "l", quantity: 1 },
      ],
    }),
  );
  assert.equal(estimate.items, 3);
  assert.equal(estimate.unpriced, 1);
  assert.equal(estimate.discountPercent, 10);
  assert.ok(estimate.min > 0);
});

test("invalid and huge quantities are clamped", () => {
  const estimate = estimateBrief(
    brief({
      items: [
        { typeId: "panel", sizeId: "m", quantity: Number.NaN },
        { typeId: "panel", sizeId: "m", quantity: -3 },
        { typeId: "panel", sizeId: "m", quantity: 10_000 },
      ],
    }),
  );
  assert.equal(estimate.items, MAX_ITEM_QUANTITY);
});

test("message lists the project, positions and the undiscounted range", () => {
  const message = briefMessage(
    brief({
      author: "  Студия Север ",
      objectType: "Ресторан",
      city: "Казань",
      stage: "Комплектация",
      deadline: "2026-12-01",
      items: [
        { typeId: "lampshade", sizeId: "m", quantity: 6 },
        { typeId: "screen", sizeId: "xl", quantity: 0 },
        { typeId: "logo", sizeId: "l", quantity: 1 },
      ],
    }),
  );
  assert.match(message, /Студия \/ дизайнер: Студия Север\n/);
  assert.match(message, /Объект: Ресторан, Казань/);
  assert.match(message, /1\. Абажур, 30–60 см — 6 шт\.\n2\. Панно с логотипом/);
  assert.doesNotMatch(message, /Перегородка/);
  assert.match(message, /Нужно к: 01\.12\.2026/);
  assert.match(message, /без скидки дизайнера, без позиций по эскизу/);
});

test("an empty brief still produces a polite opening", () => {
  const message = briefMessage(brief());
  assert.match(message, /^Здравствуйте, Ольга!/);
  assert.doesNotMatch(message, /Ориентир|Позиции/);
});
