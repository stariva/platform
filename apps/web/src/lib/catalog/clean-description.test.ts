import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanDescription } from "./clean-description";

test("turns break chains into paragraphs and drops emoji", () => {
  assert.equal(
    cleanDescription("🌿 Первый абзац<br/><br/>Второй абзац 🫶"),
    "<p>Первый абзац</p><p>Второй абзац</p>",
  );
});

test("groups dash lines into a list", () => {
  assert.equal(
    cleanDescription("Вступление<br/><br/>- Раз — один<br/><br/>- Два — два"),
    "<p>Вступление</p><ul><li>Раз — один</li><li>Два — два</li></ul>",
  );
});

test("keeps nested lists and splits text around them", () => {
  assert.equal(
    cleanDescription(
      "Особенности:<ul><li>Топ:<ul><li>Бретели</li></ul></li></ul>Итог",
    ),
    "<p><strong>Особенности</strong></p><ul><li>Топ:<ul><li>Бретели</li></ul></li></ul><p>Итог</p>",
  );
});

test("removes keyword lists but keeps ordinary sentences with commas", () => {
  const spam =
    "абажур макраме, абажур ручной работы, плетёный абажур, декор для дома, бохо, сканди, подарок";
  assert.equal(cleanDescription(`Текст<br/><br/>${spam}`), "<p>Текст</p>");
  const prose = "Мягкий свет, объёмные узлы, длинная бахрома добавят уюта.";
  assert.equal(cleanDescription(prose), `<p>${prose}</p>`);
});

test("unwraps existing paragraphs separated by stray breaks", () => {
  assert.equal(
    cleanDescription("<p>Один</p><br/><p>Два</p>"),
    "<p>Один</p><p>Два</p>",
  );
});

test("drops SEO pitches, keyword list items and the heading left behind", () => {
  assert.equal(
    cleanDescription(
      "Текст<br/><br/>Купить пояс макраме. Дизайнерский ремень, тренд 2026 года.<br/><br/>Характеристики:<ul><li>Стиль: бохо декор, сканди стиль, эко товары, минимализм, уютный дом, макраме в интерьере.</li></ul>",
    ),
    "<p>Текст</p>",
  );
});

test("treats dash lines without a space as list items", () => {
  assert.equal(
    cleanDescription("Вступление<br/><br/>-Первое<br/><br/>-Второе"),
    "<p>Вступление</p><ul><li>Первое</li><li>Второе</li></ul>",
  );
});

test("merges neighbouring lists", () => {
  assert.equal(
    cleanDescription("<ul><li>Раз</li></ul><ul><li>Два</li></ul>"),
    "<ul><li>Раз</li><li>Два</li></ul>",
  );
});

test("is idempotent: cleaned text stays as it is", () => {
  const once = cleanDescription(
    "Вступление<br/><br/>Характеристики<ul><li>Материал: хлопок</li></ul><br/><br/>Уход: стирка<br/><br/>Особенности:<ul><li>Раз</li></ul>",
  );
  assert.equal(
    once,
    "<p>Вступление</p><p><strong>Характеристики</strong></p><ul><li>Материал: хлопок</li></ul><p>Уход: стирка</p><p><strong>Особенности</strong></p><ul><li>Раз</li></ul>",
  );
  assert.equal(cleanDescription(once), once);
});
