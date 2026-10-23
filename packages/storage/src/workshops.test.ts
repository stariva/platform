import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HLS_FILE_PATTERN,
  hlsContentType,
  hlsPlaylistFile,
  isWorkshopKey,
  parseMasterPlaylist,
  planWorkshopSweep,
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

test("master playlist variants come out best first", () => {
  const master = [
    "#EXTM3U",
    "#EXT-X-INDEPENDENT-SEGMENTS",
    "#EXT-X-STREAM-INF:BANDWIDTH=2900000,AVERAGE-BANDWIDTH=2600000,RESOLUTION=720x1280",
    "v1/index.m3u8",
    "#EXT-X-STREAM-INF:BANDWIDTH=6100000,AVERAGE-BANDWIDTH=5200000,RESOLUTION=1080x1920",
    "v0/index.m3u8",
    "#EXT-X-STREAM-INF:BANDWIDTH=1200000,AVERAGE-BANDWIDTH=1100000",
    "v2/index.m3u8",
  ].join("\n");
  assert.deepEqual(parseMasterPlaylist(master), [
    { width: 1080, height: 1920, bandwidth: 6100000 },
    { width: 720, height: 1280, bandwidth: 2900000 },
    { width: 0, height: 0, bandwidth: 1200000 },
  ]);
  assert.deepEqual(parseMasterPlaylist("#EXTM3U\n"), []);
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

test("sweep removes replaced videos, old cuts and stale renditions", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  const old = new Date("2026-10-01T00:00:00Z");
  const fresh = new Date("2026-10-23T11:00:00Z");
  const graceMs = 3 * 24 * 60 * 60_000;
  const file = (key: string, lastModified = old) => ({
    key,
    size: 10,
    lastModified,
  });
  const objects = [
    file("workshops/a/l-1-new.mp4"),
    file("workshops/a/l-1-old.mp4"),
    file("workshops/a/hls/l-1-new/v2cut/master.m3u8"),
    file("workshops/a/hls/l-1-new/v1cut/index.m3u8"),
    file("workshops/a/hls/l-1-new/v1cut-2/index.m3u8"),
    file("workshops/a/hls/l-1-old/cut/index.m3u8"),
    file("workshops/a/hls/l-2/running/seg-00001.m4s"),
    file("workshops/a/hls/l-2/failed/seg-00001.m4s"),
    file("workshops/a/l-2.mp4"),
    file("workshops/a/materials/brief-1.pdf"),
    file("workshops/a/materials/brief-0.pdf"),
    // Загружено в ещё не сохранённую форму
    file("workshops/a/l-3-unsaved.mp4", fresh),
    // Курс удалён
    file("workshops/gone/l-1.mp4"),
  ];
  const plan = planWorkshopSweep(
    objects,
    {
      workshops: [
        {
          slug: "a",
          updatedAt: old,
          videoKeys: ["workshops/a/l-1-new.mp4", "workshops/a/l-2.mp4"],
          materialKeys: ["workshops/a/materials/brief-1.pdf"],
        },
      ],
      renditions: [
        {
          videoKey: "workshops/a/l-1-new.mp4",
          status: "ready",
          hlsPrefix: "workshops/a/hls/l-1-new/v2cut",
          readyHlsPrefix: "workshops/a/hls/l-1-new/v2cut",
          updatedAt: old,
        },
        {
          videoKey: "workshops/a/l-2.mp4",
          status: "processing",
          hlsPrefix: "workshops/a/hls/l-2/running",
          readyHlsPrefix: null,
          updatedAt: old,
        },
        {
          videoKey: "workshops/a/l-1-old.mp4",
          status: "ready",
          hlsPrefix: "workshops/a/hls/l-1-old/cut",
          readyHlsPrefix: "workshops/a/hls/l-1-old/cut",
          updatedAt: old,
        },
      ],
    },
    { now, graceMs },
  );
  assert.deepEqual(plan.deleteKeys.sort(), [
    "workshops/a/hls/l-1-new/v1cut-2/index.m3u8",
    "workshops/a/hls/l-1-new/v1cut/index.m3u8",
    "workshops/a/hls/l-1-old/cut/index.m3u8",
    "workshops/a/hls/l-2/failed/seg-00001.m4s",
    "workshops/a/l-1-old.mp4",
    "workshops/a/materials/brief-0.pdf",
    "workshops/gone/l-1.mp4",
  ]);
  assert.equal(plan.bytes, 70);
  assert.deepEqual(plan.staleRenditions, ["workshops/a/l-1-old.mp4"]);
});

test("sweep spares folders changed within the grace period", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  const old = new Date("2026-10-01T00:00:00Z");
  const recent = new Date("2026-10-22T00:00:00Z");
  const objects = [
    { key: "workshops/a/l-1-old.mp4", size: 1, lastModified: old },
    { key: "workshops/b/hls/l-1/v1cut/index.m3u8", size: 1, lastModified: old },
    { key: "workshops/b/hls/l-1x/cut/index.m3u8", size: 1, lastModified: old },
  ];
  const plan = planWorkshopSweep(
    objects,
    {
      workshops: [
        // Видео заменили вчера: старое ещё досматривают
        { slug: "a", updatedAt: recent, videoKeys: [], materialKeys: [] },
        {
          slug: "b",
          updatedAt: old,
          videoKeys: ["workshops/b/l-1.mp4"],
          materialKeys: [],
        },
      ],
      renditions: [
        // Вчера перерезали: прежнюю нарезку ещё смотрят
        {
          videoKey: "workshops/b/l-1.mp4",
          status: "ready",
          hlsPrefix: "workshops/b/hls/l-1/v2cut",
          readyHlsPrefix: "workshops/b/hls/l-1/v2cut",
          updatedAt: recent,
        },
      ],
    },
    { now, graceMs: 3 * 24 * 60 * 60_000 },
  );
  assert.deepEqual(plan.deleteKeys, ["workshops/b/hls/l-1x/cut/index.m3u8"]);
});
