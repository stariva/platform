/**
 * Лид — первый абзац описания, который карточка показывает под ценой.
 * Чтобы текст не повторялся, блок «Описание» выводится уже без него.
 *
 * Модуль без зависимостей: его импортирует клиентская карточка товара.
 */

export const SHORT_DESCRIPTION_MAX = 200;
// Короче — это обычно заголовок-зачин («Пляжная накидка макраме»), а не фраза
const LEAD_MIN = 60;

const BLOCK_END = /<\/(?:p|div|h\d|li)>/gi;

const plainText = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Абзацы описания чистым текстом, пустые отброшены. */
export function toParagraphs(description: string): string[] {
  return description
    .replace(/(?:<br\s*\/?>\s*){2,}/gi, "</p>")
    .replace(BLOCK_END, "</p>")
    .split("</p>")
    .map(plainText)
    .filter(Boolean);
}

/**
 * Первый абзац, если он годится в лид целиком: законченная фраза нужной
 * длины, и после него в описании ещё что-то остаётся.
 */
export function leadParagraph(paragraphs: string[]): string | undefined {
  const [first] = paragraphs;
  if (!first || paragraphs.length < 2) return undefined;
  if (first.length < LEAD_MIN || first.length > SHORT_DESCRIPTION_MAX) {
    return undefined;
  }
  return /[.!?…]$/.test(first) ? first : undefined;
}

/**
 * HTML описания без первого абзаца, если тот ушёл в лид. В остальных
 * случаях описание возвращается как есть.
 */
export function descriptionWithoutLead(description: string): string {
  const lead = leadParagraph(toParagraphs(description));
  if (!lead) return description;
  const match = description.match(/^\s*<p\b[^>]*>([\s\S]*?)<\/p>/i);
  if (!match || plainText(match[1] ?? "") !== lead) return description;
  return description.slice(match[0].length).trimStart();
}
