import { expect, test } from "bun:test";

import { receiptImageKey } from "./receipts";

test("one receipt is one file, keyed by INN and number", () => {
  expect(receiptImageKey("502480197143", "203e2ralw5", "image/png")).toBe(
    "receipts/502480197143/203e2ralw5.png",
  );
});

test("refuses types that are not images", () => {
  expect(() =>
    receiptImageKey("502480197143", "203e2ralw5", "text/html"),
  ).toThrow();
});
