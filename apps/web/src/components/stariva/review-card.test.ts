import { describe, expect, test } from "bun:test";
import { formatDate } from "./review-card";

describe("formatDate", () => {
  test("собирает дату с обычными пробелами", () => {
    expect(formatDate("2026-06-14T09:00:00.000Z")).toBe("14 июня 2026 г.");
  });

  test("считает день по Москве, а не по поясу процесса", () => {
    expect(formatDate("2026-09-03T22:30:00.000Z")).toBe("4 сентября 2026 г.");
  });
});
