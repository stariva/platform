import assert from "node:assert/strict";
import { test } from "node:test";
import { detectImageType, productImageKey } from "./catalog";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part,
    ),
  );

test("detects images by signature, not by the declared type", () => {
  assert.equal(detectImageType(bytes([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(
    detectImageType(bytes("\x89PNG\r\n\x1a\n", [0, 0])),
    "image/png",
  );
  assert.equal(detectImageType(bytes("GIF89a")), "image/gif");
  assert.equal(
    detectImageType(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 ")),
    "image/webp",
  );
  assert.equal(
    detectImageType(
      bytes([0, 0, 0, 28], "ftypmif1", [0, 0, 0, 0], "mif1avifmiaf"),
    ),
    "image/avif",
  );
});

test("rejects non-images and other ISO media", () => {
  assert.equal(detectImageType(bytes("<svg xmlns=")), null);
  assert.equal(detectImageType(bytes("<html>")), null);
  assert.equal(
    detectImageType(bytes([0, 0, 0, 20], "ftypisom", [0, 0, 0, 0], "isom")),
    null,
  );
  assert.equal(detectImageType(new Uint8Array()), null);
});

test("image key depends on content", () => {
  const key = productImageKey("p", bytes([1, 2, 3]), "image/png");
  assert.match(key, /^products\/p\/[0-9a-f]{16}\.png$/);
  assert.equal(productImageKey("p", bytes([1, 2, 3]), "image/png"), key);
});
