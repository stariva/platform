import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isWorkshopKey,
  workshopImageKey,
  workshopMaterialKey,
  workshopVideoKey,
} from "./workshops";

test("video keys live in the workshop folder and are unique per upload", () => {
  const a = workshopVideoKey("abazhur-kupol", "l-1", "video/mp4");
  const b = workshopVideoKey("abazhur-kupol", "l-1", "video/mp4");
  assert.match(a, /^workshops\/abazhur-kupol\/l-1-[0-9a-f]{10}\.mp4$/);
  assert.notEqual(a, b);
  assert.ok(isWorkshopKey("abazhur-kupol", a));
});

test("lesson ids cannot escape the workshop folder", () => {
  const key = workshopVideoKey("abazhur-kupol", "../../other/x", "video/webm");
  assert.ok(key.startsWith("workshops/abazhur-kupol/"));
  assert.ok(!key.includes(".."));
});

test("unsupported video types are refused", () => {
  assert.throws(() => workshopVideoKey("s", "l", "video/x-flv"));
});

test("material keys keep a clean file name", () => {
  const key = workshopMaterialKey("abazhur-kupol", "Выкройка схема (v2).PDF");
  assert.match(key, /^workshops\/abazhur-kupol\/materials\/[\w-]+\.pdf$/);
  assert.match(
    workshopMaterialKey("s", "!!!.pdf"),
    /^workshops\/s\/materials\/file-/,
  );
});

test("image keys are content hashed", () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const key = workshopImageKey("s", bytes, "image/webp");
  assert.equal(key, workshopImageKey("s", bytes, "image/webp"));
  assert.notEqual(key, workshopImageKey("s", new Uint8Array([9]), "image/webp"));
  assert.match(key, /^workshops\/s\/[0-9a-f]{16}\.webp$/);
});

test("isWorkshopKey only accepts the course's own folder", () => {
  assert.ok(isWorkshopKey("a", "workshops/a/x.mp4"));
  assert.ok(!isWorkshopKey("a", "workshops/ab/x.mp4"));
  assert.ok(!isWorkshopKey("a", "workshops/a/../b/x.mp4"));
  assert.ok(!isWorkshopKey("a", "products/a/x.jpg"));
  assert.ok(!isWorkshopKey("a", "workshops/a"));
});
