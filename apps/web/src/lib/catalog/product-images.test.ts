import assert from "node:assert/strict";
import { test } from "node:test";
import { productImageKey } from "@stariva/storage";
import { isExternalImage } from "./product-images";

const base = "https://storage.yandexcloud.net/stariva-public/";

test("only remote images outside our bucket need moving", () => {
  assert.equal(isExternalImage("https://ir.ozone.ru/s3/a.jpg", base), true);
  assert.equal(isExternalImage(`${base}products/p/1.jpg`, base), false);
  assert.equal(isExternalImage("/images/catalog/placeholder.jpg", base), false);
});

test("the key depends on content, not on the source URL", () => {
  const a = new Uint8Array([1, 2, 3]);
  const key = productImageKey("p-1", a, "image/jpeg");
  assert.match(key, /^products\/p-1\/[0-9a-f]{16}\.jpg$/);
  assert.equal(
    productImageKey("p-1", new Uint8Array([1, 2, 3]), "image/jpeg"),
    key,
  );
  assert.notEqual(
    productImageKey("p-1", new Uint8Array([3, 2, 1]), "image/jpeg"),
    key,
  );
  assert.match(productImageKey("p-1", a, "image/webp"), /\.webp$/);
});

test("rejects files that are not images", () => {
  assert.throws(() => productImageKey("p-1", new Uint8Array(), "text/html"));
});
