import assert from "node:assert/strict";
import { test } from "node:test";
import { stripImageMetadata } from "./strip-metadata";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((p) =>
      typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p,
    ),
  );
const has = (haystack: Uint8Array, needle: string) =>
  Buffer.from(haystack).includes(Buffer.from(needle, "latin1"));

/** Сегмент JPEG: маркер, длина (включая сами два байта длины), данные. */
const segment = (marker: number, data: string) => {
  const length = data.length + 2;
  return bytes([0xff, marker, length >> 8, length & 0xff], data);
};

test("jpeg loses EXIF, XMP and comments but keeps JFIF and image data", () => {
  const jpeg = bytes(
    [0xff, 0xd8],
    [...segment(0xe0, "JFIF\0")],
    [...segment(0xe1, "Exif\0\0GPS-55.75,37.61")],
    [...segment(0xe1, "http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>")],
    [...segment(0xfe, "shot on my phone")],
    [...segment(0xdb, "quant")],
    [0xff, 0xda, 0x00, 0x02],
    "PIXELS",
    [0xff, 0xd9],
  );
  const clean = stripImageMetadata(jpeg, "image/jpeg");
  assert.ok(clean);
  assert.ok(!has(clean, "GPS"));
  assert.ok(!has(clean, "xmpmeta"));
  assert.ok(!has(clean, "my phone"));
  assert.ok(has(clean, "JFIF"));
  assert.ok(has(clean, "quant"));
  assert.ok(has(clean, "PIXELS"));
  assert.deepEqual([...clean.subarray(-2)], [0xff, 0xd9]);
});

test("a truncated jpeg is rejected", () => {
  const broken = bytes([0xff, 0xd8], [0xff, 0xe1, 0x10, 0x00], "Exif");
  assert.equal(stripImageMetadata(broken, "image/jpeg"), null);
});

const pngChunk = (type: string, data: string) => {
  const length = data.length;
  return bytes(
    [length >>> 24, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff],
    type,
    data,
    [0, 0, 0, 0],
  );
};

test("png loses eXIf and text chunks", () => {
  const png = bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    [...pngChunk("IHDR", "header-data-13")],
    [...pngChunk("eXIf", "GPS-55.75")],
    [...pngChunk("tEXt", "Author\0Anna")],
    [...pngChunk("IDAT", "PIXELS")],
    [...pngChunk("IEND", "")],
  );
  const clean = stripImageMetadata(png, "image/png");
  assert.ok(clean);
  assert.ok(!has(clean, "GPS"));
  assert.ok(!has(clean, "Anna"));
  assert.ok(has(clean, "IHDR"));
  assert.ok(has(clean, "PIXELS"));
  assert.ok(has(clean, "IEND"));
});

const webpChunk = (type: string, data: number[] | string) => {
  const body = bytes(data);
  const size = body.length;
  return bytes(
    type,
    [size & 0xff, (size >> 8) & 0xff, 0, 0],
    [...body],
    size % 2 ? [0] : [],
  );
};

test("webp loses EXIF and XMP chunks and their VP8X flags", () => {
  const chunks = bytes(
    [...webpChunk("VP8X", [VP8X_ALL, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
    [...webpChunk("VP8 ", "PIXELS")],
    [...webpChunk("EXIF", "GPS-55.75")],
    [...webpChunk("XMP ", "<x:xmpmeta/>")],
  );
  const size = chunks.length + 4;
  const webp = bytes("RIFF", [size & 0xff, (size >> 8) & 0xff, 0, 0], "WEBP", [
    ...chunks,
  ]);
  const clean = stripImageMetadata(webp, "image/webp");
  assert.ok(clean);
  assert.ok(!has(clean, "GPS"));
  assert.ok(!has(clean, "xmpmeta"));
  assert.ok(has(clean, "PIXELS"));
  // Флаги EXIF и XMP сняты, остальные на месте
  assert.equal(clean[20], VP8X_ALL & ~0x0c);
  // Размер RIFF совпадает с файлом
  const riffSize = new DataView(clean.buffer).getUint32(4, true);
  assert.equal(riffSize + 8, clean.length);
});

const VP8X_ALL = 0x3e;
