import { expect, test } from "bun:test";
import { degrees, PDFDocument } from "@cantoo/pdf-lib";
import { extractText, getDocumentProxy } from "unpdf";

import { appendCodePage } from "./code-page";
import { CODE_PAGE_TEXT, CODE_PAGE_URL } from "./code-page-text";

async function brief(sizes: [number, number][]) {
  const doc = await PDFDocument.create();
  for (const size of sizes) doc.addPage(size);
  return doc.save();
}

async function pageTexts(pdf: Uint8Array) {
  const proxy = await getDocumentProxy(new Uint8Array(pdf));
  const { text } = await extractText(proxy, { mergePages: false });
  // Неразрывные пробелы и переносы строк сводим к обычным пробелам
  return text.map((page) => page.replace(/\s+/g, " ").trim());
}

test("дописывает страницу с кодом в конец брифа", async () => {
  const result = await appendCodePage(
    await brief([
      [595.28, 841.89],
      [595.28, 841.89],
    ]),
  );

  const doc = await PDFDocument.load(result);
  expect(doc.getPageCount()).toBe(3);

  const texts = await pageTexts(result);
  const last = texts.at(-1) ?? "";
  // Кириллица извлекается текстом, а не глифами без кодов
  expect(last).toContain(CODE_PAGE_TEXT.title);
  expect(last).toContain(CODE_PAGE_TEXT.address);
  expect(last).toContain("нажмите на адрес или QR-код");
  expect(last).toContain("наведите телефон на QR-код");
  expect(last).toContain("Код ещё не пришёл?");
  expect(texts[0]).toBe("");
});

test("QR и адрес (под кодом и в шаге) — ссылки: бриф читают и с телефона", async () => {
  const result = await appendCodePage(await brief([[595.28, 841.89]]));
  const proxy = await getDocumentProxy(new Uint8Array(result));
  const links = await (await proxy.getPage(2)).getAnnotations();
  expect(
    links.map((link: { subtype: string; url?: string }) => [
      link.subtype,
      link.url,
    ]),
  ).toEqual([
    ["Link", CODE_PAGE_URL],
    ["Link", CODE_PAGE_URL],
    ["Link", CODE_PAGE_URL],
  ]);
});

test("берёт размер последней страницы брифа", async () => {
  const square: [number, number] = [600, 600];
  const doc = await PDFDocument.load(
    await appendCodePage(await brief([[595.28, 841.89], square])),
  );
  const { width, height } = doc.getPage(2).getSize();
  expect([width, height]).toEqual(square);
});

test("поля под обрез не входят в размер страницы", async () => {
  const source = await PDFDocument.create();
  // A4 с вылетами по 9 pt: видимая часть — CropBox
  const page = source.addPage([613.28, 859.89]);
  page.setCropBox(9, 9, 595.28, 841.89);
  const doc = await PDFDocument.load(await appendCodePage(await source.save()));
  expect(doc.getPage(1).getSize()).toEqual({ width: 595.28, height: 841.89 });
});

test("у повёрнутой страницы меняет местами ширину и высоту", async () => {
  const source = await PDFDocument.create();
  const page = source.addPage([595.28, 841.89]);
  page.setRotation(degrees(90));
  const doc = await PDFDocument.load(await appendCodePage(await source.save()));
  expect(doc.getPage(1).getSize()).toEqual({ width: 841.89, height: 595.28 });
});
