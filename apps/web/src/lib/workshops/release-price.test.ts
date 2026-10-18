import { describe, expect, test } from "bun:test";
import { currentWorkshopPrice } from "./release-price";

const releaseAt = new Date("2026-10-20T07:00:00Z");

describe("currentWorkshopPrice", () => {
  test("keeps the preorder price until the lessons open", () => {
    expect(
      currentWorkshopPrice({
        slug: "elka-makrame",
        price: 690,
        releaseAt,
        now: new Date("2026-10-20T06:59:59Z"),
      }),
    ).toBe(690);
  });

  test("switches to the regular price at the release", () => {
    expect(
      currentWorkshopPrice({
        slug: "elka-makrame",
        price: 690,
        releaseAt,
        now: releaseAt,
      }),
    ).toBe(990);
  });

  test("a course without a release date sells at the regular price", () => {
    expect(
      currentWorkshopPrice({
        slug: "elka-makrame",
        price: 690,
        releaseAt: null,
      }),
    ).toBe(990);
  });

  test("leaves other courses and higher admin prices alone", () => {
    const now = new Date("2026-12-01T00:00:00Z");
    expect(
      currentWorkshopPrice({ slug: "abazhur", price: 500, releaseAt, now }),
    ).toBe(500);
    expect(
      currentWorkshopPrice({
        slug: "elka-makrame",
        price: 1290,
        releaseAt,
        now,
      }),
    ).toBe(1290);
  });
});
