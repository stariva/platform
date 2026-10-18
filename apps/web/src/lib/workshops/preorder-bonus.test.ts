import { describe, expect, test } from "bun:test";
import {
  earnsPreorderBonus,
  isGiftOnly,
  isPreorderBonusSlug,
  preorderBonusParent,
} from "./preorder-bonus";

test("isPreorderBonusSlug recognises the gift course only", () => {
  expect(isPreorderBonusSlug("elka-makrame-bolshaya")).toBe(true);
  expect(isPreorderBonusSlug("elka-makrame")).toBe(false);
  expect(preorderBonusParent("elka-makrame-bolshaya")).toBe("elka-makrame");
  expect(preorderBonusParent("elka-makrame")).toBeUndefined();
});

const releaseAt = new Date("2026-10-20T07:00:00Z");

describe("isGiftOnly", () => {
  test("the gift course is not for sale while it is still given away", () => {
    const before = new Date("2026-10-19T12:00:00Z");
    expect(isGiftOnly("elka-makrame-bolshaya", releaseAt, before)).toBe(true);
    expect(isGiftOnly("elka-makrame-bolshaya", releaseAt, releaseAt)).toBe(
      false,
    );
  });

  test("regular courses and undated parents are always for sale", () => {
    const before = new Date("2026-10-19T12:00:00Z");
    expect(isGiftOnly("elka-makrame", releaseAt, before)).toBe(false);
    expect(isGiftOnly("elka-makrame-bolshaya", null, before)).toBe(false);
  });
});

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
