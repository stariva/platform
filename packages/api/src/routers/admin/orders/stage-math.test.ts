import { expect, test } from "bun:test";
import { depositFor, paymentDueFrom, toKopecks } from "./stage-math";

test("deposit is half of the items, rounded to whole rubles", () => {
  expect(depositFor(800000)).toBe(400000);
  expect(depositFor(350050)).toBe(175000);
  expect(depositFor(350150)).toBe(175100);
});

test("payment is due in three days", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  expect(paymentDueFrom(now).toISOString()).toBe("2026-10-06T12:00:00.000Z");
});

test("rubles from the form become kopecks", () => {
  expect(toKopecks(4500)).toBe(450000);
  expect(toKopecks(99.99)).toBe(9999);
});
