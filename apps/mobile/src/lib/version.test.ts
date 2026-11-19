import { expect, test } from "bun:test";
import { compareVersions, meetsMinVersion, parseVersion } from "./version";

test("parseVersion дополняет короткие номера и отбрасывает мусор", () => {
  expect(parseVersion("1.4.0")).toEqual([1, 4, 0]);
  expect(parseVersion("2")).toEqual([2, 0, 0]);
  expect(parseVersion("1.2")).toEqual([1, 2, 0]);
  expect(parseVersion("1.4.0-beta")).toBeNull();
  expect(parseVersion("builtin")).toBeNull();
  expect(parseVersion("")).toBeNull();
});

test("compareVersions сравнивает числа, а не строки", () => {
  expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
  expect(compareVersions("1.0.0", "1.0.1")).toBeLessThan(0);
  expect(compareVersions("1.0", "1.0.0")).toBe(0);
  expect(compareVersions("x", "1.0.0")).toBeNull();
});

test("meetsMinVersion: старая оболочка не проходит, непонятный номер не блокирует", () => {
  expect(meetsMinVersion("1.2.0", "1.3.0")).toBe(false);
  expect(meetsMinVersion("1.3.0", "1.3.0")).toBe(true);
  expect(meetsMinVersion("2.0.0", "1.3.0")).toBe(true);
  expect(meetsMinVersion("dev", "1.3.0")).toBe(true);
  expect(meetsMinVersion("1.0.0", "")).toBe(true);
});
