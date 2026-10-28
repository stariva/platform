import { expect, test } from "bun:test";
import { getBundle } from "@/lib/workshops/bundles";
import type { Workshop } from "@/lib/workshops-data";
import { komboChoices, komboOffer } from "./_data";

const workshop: Workshop = {
  slug: "elka-makrame",
  status: "published",
  title: "Ёлка",
  subtitle: "",
  category: "interior",
  level: "beginner",
  price: 990,
  duration: "",
  lessonsCount: 0,
  cover: "",
  previewImage: "",
  description: "",
  whatYouLearn: [],
  materials: [],
  lessons: [],
  brief: { howTo: "", shops: [], outro: "", image: "" },
};
const bundle = getBundle("elka-makrame-kombo");
if (!bundle) throw new Error("Missing tree bundle");
const releaseAt = "2026-11-03T07:00:00Z";
const before = new Date("2026-10-28T12:00:00Z");

for (const [smallDelayed, bigDelayed, expected] of [
  [
    false,
    false,
    "Оба мастер-класса открываются сразу — с телефона или компьютера",
  ],
  [false, true, "Ёлка 50 × 110 см откроется сразу, большая — 3 ноября"],
  [true, false, "Ёлка 50 × 110 см откроется 3 ноября, большая — сразу"],
  [true, true, "Ёлка 50 × 110 см откроется 3 ноября, большая — 3 ноября"],
] as const) {
  test(`combo access: small delayed=${smallDelayed}, big delayed=${bigDelayed}`, () => {
    const small = {
      ...workshop,
      releaseAt: smallDelayed ? releaseAt : undefined,
    };
    const big = { ...workshop, releaseAt: bigDelayed ? releaseAt : undefined };
    expect(
      komboChoices(bundle, small, big, before)[0].access.replace(/\s/g, " "),
    ).toBe(expected);
  });
}

test("each course keeps its own release date and becomes available at release", () => {
  const small = { ...workshop, releaseAt };
  const big = { ...workshop, releaseAt: "2026-11-05T07:00:00Z" };
  expect(komboOffer(bundle, small, big, before)).toMatchObject({
    smallReleaseLabel: "3 ноября",
    bigReleaseLabel: "5 ноября",
  });
  expect(
    komboChoices(bundle, small, big, new Date(releaseAt))[0].access.replace(
      /\s/g,
      " ",
    ),
  ).toBe("Ёлка 50 × 110 см откроется сразу, большая — 5 ноября");
});
