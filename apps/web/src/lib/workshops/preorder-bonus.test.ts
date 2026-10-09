import { describe, expect, test } from "bun:test";
import { earnsPreorderBonus, isPreorderBonusSlug } from "./preorder-bonus";

test("isPreorderBonusSlug recognises the gift course only", () => {
  expect(isPreorderBonusSlug("elka-makrame-bolshaya")).toBe(true);
  expect(isPreorderBonusSlug("elka-makrame")).toBe(false);
});

const releaseAt = new Date("2026-10-20T07:00:00Z");

describe("earnsPreorderBonus", () => {
  test("a preorder of the small tree earns the big tree workshop", () => {
    expect(
      earnsPreorderBonus({
        workshopSlug: "elka-makrame",
        orderedAt: new Date("2026-10-09T12:00:00Z"),
        releaseAt,
      })?.slug,
    ).toBe("elka-makrame-bolshaya");
  });

  test("buying after the release earns nothing", () => {
    expect(
      earnsPreorderBonus({
        workshopSlug: "elka-makrame",
        orderedAt: new Date("2026-10-20T07:00:00Z"),
        releaseAt,
      }),
    ).toBeUndefined();
  });

  test("workshops without a bonus or a release date earn nothing", () => {
    const orderedAt = new Date("2026-10-09T12:00:00Z");
    expect(
      earnsPreorderBonus({ workshopSlug: "abazhur", orderedAt, releaseAt }),
    ).toBeUndefined();
    expect(
      earnsPreorderBonus({
        workshopSlug: "elka-makrame",
        orderedAt,
        releaseAt: null,
      }),
    ).toBeUndefined();
  });
});
