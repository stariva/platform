import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HLS_FILE_PATTERN,
  hlsContentType,
  hlsPlaylistFile,
  isWorkshopKey,
  workshopHlsPrefix,
  workshopImageKey,
  workshopMaterialFileName,
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

test("HLS folder sits next to the source video and is unique per upload", () => {
  assert.equal(
    workshopHlsPrefix("workshops/abazhur-kupol/l-1-0a1b2c3d4e.mp4"),
    "workshops/abazhur-kupol/hls/l-1-0a1b2c3d4e",
  );
  assert.ok(
    isWorkshopKey(
      "abazhur-kupol",
      `${workshopHlsPrefix("workshops/abazhur-kupol/l-1.mov")}/index.m3u8`,
    ),
  );
});

test("only playlist, init segment and numbered chunks are HLS files", () => {
  for (const ok of [
    "index.m3u8",
    "init.mp4",
    "seg-00042.m4s",
    "master.m3u8",
    "v0/index.m3u8",
    "v1/init.mp4",
    "v2/seg-00042.m4s",
  ]) {
    assert.match(ok, HLS_FILE_PATTERN);
  }
  for (const bad of [
    "../index.m3u8",
    "seg-1.m4s",
    "other.mp4",
    "index.m3u8x",
    "v0/master.m3u8",
    "v0/../index.m3u8",
    "v10/index.m3u8",
    "/v0/index.m3u8",
    "v0/v1/index.m3u8",
  ]) {
    assert.doesNotMatch(bad, HLS_FILE_PATTERN);
  }
  assert.equal(hlsContentType("seg-00001.m4s"), "video/iso.segment");
  assert.equal(hlsContentType("index.m3u8"), "application/vnd.apple.mpegurl");
  assert.equal(hlsContentType("v1/init.mp4"), "video/mp4");
  assert.equal(hlsPlaylistFile(1), "index.m3u8");
  assert.equal(hlsPlaylistFile(2), "master.m3u8");
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
  assert.notEqual(
    key,
    workshopImageKey("s", new Uint8Array([9]), "image/webp"),
  );
  assert.match(key, /^workshops\/s\/[0-9a-f]{16}\.webp$/);
});

test("isWorkshopKey only accepts the course's own folder", () => {
  assert.ok(isWorkshopKey("a", "workshops/a/x.mp4"));
  assert.ok(!isWorkshopKey("a", "workshops/ab/x.mp4"));
  assert.ok(!isWorkshopKey("a", "workshops/a/../b/x.mp4"));
  assert.ok(!isWorkshopKey("a", "products/a/x.jpg"));
  assert.ok(!isWorkshopKey("a", "workshops/a"));
});

test("material attachment is named after its label", () => {
  assert.equal(
    workshopMaterialFileName("Бриф «Ёлка макраме»"),
    "Бриф «Ёлка макраме».pdf",
  );
  assert.equal(workshopMaterialFileName("a/b: c.PDF"), "a b c.pdf");
  assert.equal(workshopMaterialFileName("  "), "Материалы.pdf");
});
