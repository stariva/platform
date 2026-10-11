import { expect, test } from "bun:test";
import { previewText, toTranscriptParts } from "./text";

test("keeps text and summarizes tool results, skipping service parts", () => {
  const parts = toTranscriptParts([
    { type: "step-start" },
    {
      type: "tool-searchProducts",
      state: "output-available",
      input: { query: "абажур" },
      output: {
        products: [{ name: "Абажур «Лён»", url: "/catalog/abazhur-len" }],
        total: 1,
      },
    },
    { type: "text", text: "Нашла один абажур." },
  ]);

  expect(parts).toEqual([
    {
      type: "tool",
      tool: "searchProducts",
      label: "Искала изделия в каталоге",
      detail: "абажур",
      items: [{ title: "Абажур «Лён»", url: "/catalog/abazhur-len" }],
      failed: false,
    },
    { type: "text", text: "Нашла один абажур." },
  ]);
});

test("marks a tool without a result as failed", () => {
  const [part] = toTranscriptParts([
    { type: "tool-estimateCustomOrder", state: "input-available", input: {} },
  ]);
  expect(part).toMatchObject({ type: "tool", failed: true, items: [] });
});

test("preview joins text parts and trims long questions", () => {
  expect(
    previewText([
      { type: "text", text: "Здравствуйте!\nЕсть  ли" },
      { type: "text", text: "абажуры?" },
    ]),
  ).toBe("Здравствуйте! Есть ли абажуры?");
  expect(previewText([{ type: "text", text: "а".repeat(200) }], 10)).toBe(
    `${"а".repeat(9)}…`,
  );
});
