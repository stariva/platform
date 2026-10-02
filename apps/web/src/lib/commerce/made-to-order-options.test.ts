import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  describeMadeToOrderOptions,
  madeToOrderOptionsSchema,
  measurementEntrySchema,
} from "./made-to-order-options";

test("measurements accept positive numbers with a dot or comma", () => {
  for (const value of ["92", "92.5", "92,5", " 7 "]) {
    assert.equal(
      measurementEntrySchema.safeParse({ label: "Талия", value }).success,
      true,
      value,
    );
  }
});

test("measurements reject zero, negatives, units and noise", () => {
  for (const value of ["0", "-5", "92 см", "abc", "", "1e3", "12345"]) {
    assert.equal(
      measurementEntrySchema.safeParse({ label: "Талия", value }).success,
      false,
      value,
    );
  }
});

test("options default to no measurements", () => {
  const options = madeToOrderOptionsSchema.parse({
    size: "M",
    color: "Молочный",
  });

  assert.deepEqual(options.measurements, []);
});

test("options require a size and a color", () => {
  assert.equal(
    madeToOrderOptionsSchema.safeParse({ size: "", color: "Молочный" }).success,
    false,
  );
  assert.equal(
    madeToOrderOptionsSchema.safeParse({ size: "M" }).success,
    false,
  );
});

test("options are described in one line for the cart and the master", () => {
  assert.equal(
    describeMadeToOrderOptions({
      size: "M",
      color: "Графит",
      measurements: [{ label: "Рост", value: "170" }],
      comment: "Длиннее",
    }),
    "Размер: M · Цвет: Графит · Рост: 170 см · Комментарий: Длиннее",
  );
  assert.equal(
    describeMadeToOrderOptions({
      size: "M",
      color: "Графит",
      measurements: [],
    }),
    "Размер: M · Цвет: Графит",
  );
});
