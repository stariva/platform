import { readFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import QRCode from "qrcode";

/*
 * Последняя страница PDF-брифа для Ярмарки Мастеров: как открыть видеоуроки
 * по коду. Повторяет лист из админки (access-codes/pdf-page): ссылок в чате
 * Ярмарки слать нельзя, поэтому адрес и QR покупатель находит в самом файле.
 */

export const CODE_PAGE_URL = "https://stariva.ru/code";

const A4: [number, number] = [595.28, 841.89];

const INK = rgb(0x2c / 255, 0x24 / 255, 0x1b / 255);
const MUTED = rgb(0x6b / 255, 0x5d / 255, 0x4f / 255);
const PAPER = rgb(0xf7 / 255, 0xf2 / 255, 0xea / 255);

// Неразрывный пробел: тире не начинает строку, предлог не висит в конце
const NBSP = " ";

export const CODE_PAGE_TEXT = {
  brand: "STARIVA",
  title: "Видеоуроки к мастер-классу",
  lead: `В этом файле${NBSP}— схема и материалы. Видео, где Ольга показывает каждый шаг, откроется по коду.`,
  address: "stariva.ru/code",
  steps: [
    "1. Наведите камеру телефона на QR-код.",
    "2. Введите код из сообщения Ольги в чате заказа на Ярмарке Мастеров.",
    `3. Укажите email${NBSP}— пришлём на него ссылку на уроки.`,
  ],
  footer: `Код ещё не пришёл? Напишите Ольге в чат заказа${NBSP}— она пришлёт его в${NBSP}течение дня.`,
};

// Cormorant Garamond — тот же шрифт, что на сайте; Medium читается в печати
let fontBytes: Promise<Buffer> | undefined;
const loadFont = () =>
  (fontBytes ??= readFile(
    new URL("./fonts/CormorantGaramond-Medium.ttf", import.meta.url),
  ));

/**
 * Дописывает в конец PDF страницу с QR-кодом и адресом stariva.ru/code.
 * Размер страницы — как у последней страницы брифа, у пустого файла — A4.
 */
export async function appendCodePage(
  pdf: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  // Название и автор брифа остаются как были
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(await loadFont(), { subset: true });

  const pages = doc.getPages();
  const last = pages.at(-1);
  let size = A4;
  if (last) {
    const { width, height } = last.getSize();
    const turned = last.getRotation().angle % 180 !== 0;
    size = turned ? [height, width] : [width, height];
  }
  drawCodePage(doc.addPage(size), font);
  // pdf-lib пишет в обычный ArrayBuffer — файл можно сразу отдать как File
  return (await doc.save()) as Uint8Array<ArrayBuffer>;
}

type Line = { text: string; size: number; color: typeof INK; gap: number };

function drawCodePage(page: PDFPage, font: PDFFont) {
  const { width, height } = page.getSize();
  // Вёрстка рассчитана на A4; другой формат — тот же лист в масштабе
  const scale = Math.min(width / A4[0], height / A4[1]);
  const content = A4[0] * scale * 0.82;
  const narrow = content * 0.85;

  page.drawRectangle({ x: 0, y: 0, width, height, color: PAPER });

  const qrModules = QRCode.create(CODE_PAGE_URL, {
    errorCorrectionLevel: "M",
  }).modules;
  const qrSide = content * 0.42;

  const lead = wrap(CODE_PAGE_TEXT.lead, font, 16 * scale, narrow);
  const steps = CODE_PAGE_TEXT.steps.map((step) =>
    wrap(step, font, 16 * scale, content),
  );
  const footer = wrap(CODE_PAGE_TEXT.footer, font, 13 * scale, narrow);

  const leading = (size: number) => size * 1.375;
  const blockHeight = (lines: string[], size: number) =>
    lines.length * leading(size);

  // Высота всего листа — чтобы поставить его по центру страницы
  const gaps = {
    title: 30,
    lead: 16,
    qr: 36,
    address: 14,
    steps: 30,
    footer: 36,
  };
  const stepGap = 10 * scale;
  const total =
    13 * scale +
    (gaps.title +
      gaps.lead +
      gaps.qr +
      gaps.address +
      gaps.steps +
      gaps.footer) *
      scale +
    leading(34 * scale) +
    blockHeight(lead, 16 * scale) +
    qrSide +
    leading(28 * scale) +
    steps.reduce((sum, lines) => sum + blockHeight(lines, 16 * scale), 0) +
    stepGap * (steps.length - 1) +
    blockHeight(footer, 13 * scale);

  let top = (height + total) / 2;

  const centered = (lines: string[], line: Omit<Line, "text" | "gap">) => {
    for (const text of lines) {
      const lineHeight = leading(line.size);
      const textWidth = font.widthOfTextAtSize(text, line.size);
      page.drawText(text, {
        x: (width - textWidth) / 2,
        // Базовая линия — примерно на 3/4 высоты строки
        y: top - lineHeight * 0.78,
        size: line.size,
        font,
        color: line.color,
      });
      top -= lineHeight;
    }
  };

  // «STARIVA» разрядкой 0.3em: pdf-lib не умеет межбуквенный интервал
  const brandSize = 13 * scale;
  const tracking = brandSize * 0.3;
  const letters = [...CODE_PAGE_TEXT.brand];
  const brandWidth =
    letters.reduce(
      (sum, ch) => sum + font.widthOfTextAtSize(ch, brandSize),
      0,
    ) +
    tracking * (letters.length - 1);
  let x = (width - brandWidth) / 2;
  for (const ch of letters) {
    page.drawText(ch, {
      x,
      y: top - brandSize,
      size: brandSize,
      font,
      color: INK,
    });
    x += font.widthOfTextAtSize(ch, brandSize) + tracking;
  }
  top -= brandSize + gaps.title * scale;

  centered([CODE_PAGE_TEXT.title], { size: 34 * scale, color: INK });
  top -= gaps.lead * scale;
  centered(lead, { size: 16 * scale, color: MUTED });
  top -= gaps.qr * scale;

  // QR вектором, одним контуром: у отдельных квадратов между рядами
  // просвечивают щели. Каждый ряд — отрезки из подряд идущих тёмных модулей
  let path = "";
  for (let row = 0; row < qrModules.size; row++) {
    let col = 0;
    while (col < qrModules.size) {
      if (!qrModules.get(row, col)) {
        col++;
        continue;
      }
      const start = col;
      while (col < qrModules.size && qrModules.get(row, col)) col++;
      path += `M${start} ${row}h${col - start}v1h${start - col}z`;
    }
  }
  page.drawSvgPath(path, {
    x: (width - qrSide) / 2,
    y: top,
    scale: qrSide / qrModules.size,
    color: INK,
  });
  top -= qrSide + gaps.address * scale;

  centered([CODE_PAGE_TEXT.address], { size: 28 * scale, color: INK });
  top -= gaps.steps * scale;

  // Шаги — блок с выравниванием по левому краю, сам блок по центру
  const stepSize = 16 * scale;
  const stepsWidth = Math.max(
    ...steps.flat().map((text) => font.widthOfTextAtSize(text, stepSize)),
  );
  const stepsLeft = (width - stepsWidth) / 2;
  steps.forEach((lines, index) => {
    if (index > 0) top -= stepGap;
    for (const text of lines) {
      const lineHeight = leading(stepSize);
      page.drawText(text, {
        x: stepsLeft,
        y: top - lineHeight * 0.78,
        size: stepSize,
        font,
        color: INK,
      });
      top -= lineHeight;
    }
  });
  top -= gaps.footer * scale;

  centered(footer, { size: 13 * scale, color: MUTED });
}

/** Разбивает текст на строки не шире maxWidth — по словам. */
function wrap(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
