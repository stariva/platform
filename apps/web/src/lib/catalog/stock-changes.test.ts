import assert from "node:assert/strict";
import { test } from "node:test";
import { stockChanges } from "./stock-changes";

const row = { id: "a", ozonProductId: 1, ozonSku: 10, stockAvailable: 0 };

test("returns only products whose free stock changed", () => {
  const stocks = new Map([
    [1, 2],
    [2, 0],
  ]);
  assert.deepEqual(
    stockChanges(
      [row, { ...row, id: "b", ozonProductId: 2, stockAvailable: 0 }],
      stocks,
    ),
    [{ id: "a", stockAvailable: 2 }],
  );
});

test("a product missing from Ozon or without SKU drops to zero", () => {
  assert.deepEqual(
    stockChanges(
      [
        { ...row, stockAvailable: 3 },
        { ...row, id: "b", ozonSku: null, stockAvailable: 1 },
      ],
      new Map([[1, 0]]),
    ),
    [
      { id: "a", stockAvailable: 0 },
      { id: "b", stockAvailable: 0 },
    ],
  );
  assert.deepEqual(stockChanges([{ ...row, stockAvailable: 1 }], new Map()), [
    { id: "a", stockAvailable: 0 },
  ]);
});
