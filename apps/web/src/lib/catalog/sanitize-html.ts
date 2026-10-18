import { Parser } from "htmlparser2";

/**
 * Описание товара — HTML, который мастер пишет в админке руками или который
 * пришёл из Ozon. Карточка вставляет его как есть, поэтому перед выдачей
 * оставляем только разметку текста: так ни опечатка, ни взломанная учётка
 * админа не превратятся в скрипт на витрине.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "hr",
  "div",
  "span",
  "ul",
  "ol",
  "li",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "a",
]);

const VOID_TAGS = new Set(["br", "hr"]);

/** Их содержимое — не текст описания: выбрасываем вместе с тегом. */
const DROPPED_WITH_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "template",
  "svg",
  "math",
  "textarea",
  "select",
  "title",
]);

const escapeText = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeAttribute = (value: string) =>
  escapeText(value).replace(/"/g, "&quot;");

/** Ссылка на страницу, почту или телефон; javascript: и data: — нет. */
function safeHref(value: string | undefined): string | null {
  if (!value) return null;
  // Браузер игнорирует пробелы и управляющие символы внутри схемы
  // («java\tscript:»), поэтому проверяем адрес без них
  // biome-ignore lint/suspicious/noControlCharactersInRegex: вырезаем именно управляющие символы
  const compact = value.replace(/[\u0000- \u007f-\u009f]/g, "");
  if (/^(?:https?:|mailto:|tel:)/i.test(compact)) return value.trim();
  if (/^\/(?![/\\])/.test(compact) || compact.startsWith("#")) {
    return value.trim();
  }
  return null;
}

export function sanitizeDescriptionHtml(html: string): string {
  let out = "";
  // Глубина внутри выброшенных тегов: пока она больше нуля, текст не пишем
  let dropped = 0;

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (DROPPED_WITH_CONTENT.has(name)) {
          dropped++;
          return;
        }
        if (dropped > 0 || !ALLOWED_TAGS.has(name)) return;
        if (name === "a") {
          const href = safeHref(attribs.href);
          out += href
            ? `<a href="${escapeAttribute(href)}" rel="nofollow noopener noreferrer">`
            : "<a>";
          return;
        }
        out += `<${name}>`;
      },
      ontext(text) {
        if (dropped === 0) out += escapeText(text);
      },
      onclosetag(name) {
        if (DROPPED_WITH_CONTENT.has(name)) {
          dropped = Math.max(0, dropped - 1);
          return;
        }
        if (dropped > 0 || !ALLOWED_TAGS.has(name) || VOID_TAGS.has(name)) {
          return;
        }
        out += `</${name}>`;
      },
    },
    {
      decodeEntities: true,
      lowerCaseTags: true,
      lowerCaseAttributeNames: true,
    },
  );
  parser.write(html);
  parser.end();
  return out;
}
