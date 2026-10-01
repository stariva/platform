import { expect, test } from "bun:test";
import { detectImageType, productImageKey } from "./catalog";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part,
    ),
  );

test("detects images by signature, not by the declared type", () => {
  expect(detectImageType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  expect(detectImageType(bytes("\x89PNG\r\n\x1a\n", [0, 0]))).toBe("image/png");
  expect(detectImageType(bytes("GIF89a"))).toBe("image/gif");
  expect(detectImageType(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "))).toBe(
    "image/webp",
  );
  expect(
    detectImageType(
      bytes([0, 0, 0, 28], "ftypmif1", [0, 0, 0, 0], "mif1avifmiaf"),
    ),
  ).toBe("image/avif");
});

test("rejects non-images and other ISO media", () => {
  expect(detectImageType(bytes("<svg xmlns="))).toBeNull();
  expect(detectImageType(bytes("<html>"))).toBeNull();
  expect(
    detectImageType(bytes([0, 0, 0, 20], "ftypisom", [0, 0, 0, 0], "isom")),
  ).toBeNull();
  expect(detectImageType(new Uint8Array())).toBeNull();
});

test("image key depends on content", () => {
  const a = productImageKey("p", bytes([1, 2, 3]), "image/png");
  expect(a).toMatch(/^products\/p\/[0-9a-f]{16}\.png$/);
  expect(productImageKey("p", bytes([1, 2, 3]), "image/png")).toBe(a);
});
