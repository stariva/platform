import assert from "node:assert/strict";
import { test } from "node:test";
import { toShortDescription } from "./transformers";

test("joins paragraphs with full stops and keeps existing punctuation", () => {
  assert.equal(
    toShortDescription(
      "Пояс с бахромой<br/><br/>Добавьте образу фактуры!",
      "Пояс",
    ),
    "Пояс с бахромой. Добавьте образу фактуры!",
  );
});

test("falls back to the name for an empty description", () => {
  assert.equal(toShortDescription("<p> </p>", "Пояс"), "Пояс");
});

test("cuts at a sentence boundary when one fits", () => {
  const first = `${"слово ".repeat(25).trim()}.`;
  const text = toShortDescription(
    `<p>${first}</p><p>${"ещё ".repeat(30)}</p>`,
    "x",
  );
  assert.equal(text, first);
});

test("cuts at a word with an ellipsis when there is no sentence end", () => {
  const text = toShortDescription(`<p>${"слово ".repeat(60)}</p>`, "x");
  assert.ok(text.length <= 201);
  assert.ok(text.endsWith("слово…"));
});
