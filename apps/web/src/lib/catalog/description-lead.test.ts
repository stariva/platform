import assert from "node:assert/strict";
import { test } from "node:test";
import { toShortDescription } from "../ozon/transformers";
import { descriptionWithoutLead } from "./description-lead";

const LEAD =
  "Ажурная пляжная туника из хлопкового шнура с вырезом халтер и длинной бахромой.";
const HTML = `<p>${LEAD}</p><p>Носите поверх купальника.</p>`;

test("a sentence-length first paragraph becomes the lead as a whole", () => {
  assert.equal(toShortDescription(HTML, "Туника"), LEAD);
});

test("the description section drops the paragraph shown as the lead", () => {
  assert.equal(
    descriptionWithoutLead(HTML),
    "<p>Носите поверх купальника.</p>",
  );
});

test("a heading-like first paragraph stays in the description", () => {
  const html = "<p>Пляжная накидка макраме</p><p>Лёгкая и ажурная.</p>";
  assert.equal(
    toShortDescription(html, "x"),
    "Пляжная накидка макраме. Лёгкая и ажурная.",
  );
  assert.equal(descriptionWithoutLead(html), html);
});

test("a single-paragraph description is kept whole", () => {
  const html = `<p>${LEAD}</p>`;
  assert.equal(descriptionWithoutLead(html), html);
});
