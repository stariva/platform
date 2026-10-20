import { expect, test } from "bun:test";

import {
  formatAccessCode,
  generateAccessCode,
  normalizeAccessCode,
} from "./access-codes";

test("a new code is six digits", () => {
  for (let i = 0; i < 50; i++) {
    expect(generateAccessCode()).toMatch(/^\d{6}$/);
  }
});

test("the code reads in two halves", () => {
  expect(formatAccessCode("482719")).toBe("482 719");
});

test("spaces and dashes the buyer typed are ignored", () => {
  expect(normalizeAccessCode(" 482-719 ")).toBe("482719");
  expect(normalizeAccessCode("482 719")).toBe("482719");
});

test("a code with missing or extra digits is rejected", () => {
  expect(normalizeAccessCode("482 71")).toBeNull();
  expect(normalizeAccessCode("4827190")).toBeNull();
  expect(normalizeAccessCode("")).toBeNull();
});
