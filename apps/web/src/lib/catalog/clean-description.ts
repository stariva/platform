/**
 * Приводит описание товара из Ozon к аккуратному HTML: абзацы и списки вместо
 * цепочек <br/>, без эмодзи и без «поисковых» хвостов из перечня ключевых фраз.
 */

// Эмодзи, соединитель нулевой ширины (ZWJ) и селектор вариации (VS16)
const EMOJI = /\p{Extended_Pictographic}/gu;
const INVISIBLE = new RegExp(
  `${String.fromCharCode(0x200d)}|${String.fromCharCode(0xfe0f)}`,
  "g",
);
const BREAKS = /(?:<br\s*\/?>\s*){2,}/gi;
const EDGE_BREAKS = /^(?:<br\s*\/?>\s*)+|(?:<br\s*\/?>\s*)+$/gi;
const BULLET = /^[-–•]\s*(?=\S)/;
/** «Купить … 2026 года» — продающий абзац для поисковиков, а не описание. */
const SEO_PITCH = /^Купить .{0,400}\b20\d\d\b/i;
const HEADING =
  /^(?:Характеристики|Преимущества|Особенности|Параметры|Размеры)$/i;

const plain = (html: string) => html.replace(/<[^>]+>/g, "").trim();

/** Список ключевых фраз для поисковиков: много запятых, короткие обрывки. */
function isKeywordSpam(text: string): boolean {
  // Цвет, размер и состав законно перечисляют через запятую
  if (/^(?:Цвет|Размеры?|Состав|Материал|Уход):/i.test(text)) return false;
  // «Стиль: бохо, сканди, …» — смотрим на перечень после подписи
  const list = text.includes(":") ? text.slice(text.indexOf(":") + 1) : text;
  const parts = list.split(",").map((part) => part.trim());
  if (parts.length < 5) return false;
  const avg = parts.reduce((sum, part) => sum + part.length, 0) / parts.length;
  return avg < 30 && !/[.!?]\s/.test(list);
}

/** Режет HTML на куски верхнего уровня: текст и целые списки <ul>…</ul>. */
function splitTopLevel(html: string): string[] {
  const chunks: string[] = [];
  let depth = 0;
  let start = 0;
  for (const match of html.matchAll(/<\/?ul>/gi)) {
    const index = match.index ?? 0;
    if (match[0].startsWith("</")) {
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        chunks.push(html.slice(start, index + match[0].length));
        start = index + match[0].length;
      }
    } else {
      if (depth === 0) {
        chunks.push(html.slice(start, index));
        start = index;
      }
      depth += 1;
    }
  }
  chunks.push(html.slice(start));
  return chunks;
}

function paragraph(block: string): string {
  const text = plain(block);
  if (!text) return "";
  // Короткая строка с двоеточием — подзаголовок списка
  const isHeading =
    text.length < 60 &&
    (text.endsWith(":") || HEADING.test(text)) &&
    !/<br/i.test(block);
  if (!isHeading) return `<p>${block}</p>`;
  // Повторная чистка не должна оборачивать готовый подзаголовок второй раз
  const bare = block.replace(/^<strong>|<\/strong>$/g, "").replace(/:$/, "");
  return `<p><strong>${bare}</strong></p>`;
}

/** Убирает пункты-перечни ключевых фраз; пустой список исчезает целиком. */
function dropSpamItems(list: string): string {
  const kept = list.replace(
    /<li>((?:(?!<\/?(?:li|ul)>)[\s\S])*)<\/li>/gi,
    (item, inner: string) => (isKeywordSpam(plain(inner)) ? "" : item),
  );
  return /<li>/i.test(kept) ? kept : "";
}

export function cleanDescription(html: string): string {
  const source = html
    .replace(EMOJI, "")
    .replace(INVISIBLE, "")
    .replace(/<\/?p>/gi, "<br/><br/>")
    .replace(/[ \t]+/g, " ");

  const out: string[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (bullets.length > 0) {
      out.push(
        `<ul>${bullets.map((item) => `<li>${item}</li>`).join("")}</ul>`,
      );
      bullets = [];
    }
  };

  for (const chunk of splitTopLevel(source)) {
    if (/^\s*<ul>/i.test(chunk)) {
      flushBullets();
      out.push(dropSpamItems(chunk.trim()));
      continue;
    }
    for (const rawBlock of chunk.split(BREAKS)) {
      const block = rawBlock
        .trim()
        .replace(EDGE_BREAKS, "")
        .replace(/^!\s+/, "")
        .trim();
      const text = plain(block);
      if (
        !text ||
        /^описание товара:?$/i.test(text) ||
        SEO_PITCH.test(text) ||
        isKeywordSpam(text)
      ) {
        continue;
      }
      if (BULLET.test(block)) {
        bullets.push(block.replace(BULLET, ""));
        continue;
      }
      flushBullets();
      out.push(paragraph(block));
    }
  }
  flushBullets();

  // Подзаголовок, под которым список вырезан как спам, тоже лишний
  const isHeadingBlock = (block: string) => block.startsWith("<p><strong>");
  const blocks = out.filter(Boolean);
  return blocks
    .filter((block, i) => {
      const next = blocks[i + 1];
      return (
        !isHeadingBlock(block) || (next !== undefined && !isHeadingBlock(next))
      );
    })
    .join("")
    .replaceAll("</ul><ul>", "");
}
