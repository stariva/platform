import { expect, test } from "bun:test";
import { sanitizeDescriptionHtml } from "./sanitize-html";

test("text markup from the admin form survives", () => {
  const html =
    "<p>Абажур <strong>ручной работы</strong>.</p><ul><li>хлопок</li><li>дерево</li></ul><p>Строка<br>и ещё</p>";
  expect(sanitizeDescriptionHtml(html)).toBe(html);
});

test("entities stay escaped", () => {
  expect(sanitizeDescriptionHtml("<p>5 &lt; 7 &amp; «ёлка»</p>")).toBe(
    "<p>5 &lt; 7 &amp; «ёлка»</p>",
  );
});

test("scripts and their content are removed", () => {
  expect(
    sanitizeDescriptionHtml(
      "<p>до</p><script>alert(1)</script><style>p{}</style><p>после</p>",
    ),
  ).toBe("<p>до</p><p>после</p>");
});

test("event handlers and styles are dropped from allowed tags", () => {
  expect(
    sanitizeDescriptionHtml(
      '<p onclick="alert(1)" style="position:fixed">текст</p><img src=x onerror=alert(1)>',
    ),
  ).toBe("<p>текст</p>");
});

test("only safe links keep their href", () => {
  expect(sanitizeDescriptionHtml('<a href="https://stariva.ru/a">ok</a>')).toBe(
    '<a href="https://stariva.ru/a" rel="nofollow noopener noreferrer">ok</a>',
  );
  expect(sanitizeDescriptionHtml('<a href="/catalog">ok</a>')).toBe(
    '<a href="/catalog" rel="nofollow noopener noreferrer">ok</a>',
  );
  for (const href of [
    "javascript:alert(1)",
    "java\tscript:alert(1)",
    " JAVASCRIPT:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "//evil.example",
    "/\\evil.example",
  ]) {
    expect(sanitizeDescriptionHtml(`<a href="${href}">x</a>`)).toBe("<a>x</a>");
  }
});

test("broken markup cannot smuggle a tag through", () => {
  const result = sanitizeDescriptionHtml(
    '<p>a</p><<script>alert(1)//<</script><svg><g onload="alert(1)"></g></svg><p title="x"><b>b</p>',
  );
  expect(result).not.toContain("<script");
  expect(result).not.toContain("onload");
  expect(result).not.toContain("<svg");
  expect(result).not.toContain("title");
});
