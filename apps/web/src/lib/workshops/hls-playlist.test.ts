import assert from "node:assert/strict";
import { test } from "node:test";
import { signPlaylistSegments } from "./hls-playlist";

const sign = async (file: string) => `https://bucket.example/p/${file}?sig=1`;

test("signPlaylistSegments подписывает init и куски в папке качества", async () => {
  const playlist = [
    "#EXTM3U",
    "#EXT-X-VERSION:7",
    '#EXT-X-MAP:URI="init.mp4"',
    "#EXTINF:6.0,",
    "seg-00000.m4s",
    "#EXTINF:6.0,",
    "seg-00001.m4s",
    "#EXT-X-ENDLIST",
    "",
  ].join("\n");
  const signed = await signPlaylistSegments(playlist, "v1/", sign);
  assert.equal(
    signed,
    [
      "#EXTM3U",
      "#EXT-X-VERSION:7",
      '#EXT-X-MAP:URI="https://bucket.example/p/v1/init.mp4?sig=1"',
      "#EXTINF:6.0,",
      "https://bucket.example/p/v1/seg-00000.m4s?sig=1",
      "#EXTINF:6.0,",
      "https://bucket.example/p/v1/seg-00001.m4s?sig=1",
      "#EXT-X-ENDLIST",
      "",
    ].join("\n"),
  );
});

test("signPlaylistSegments не трогает чужие адреса и плейлисты", async () => {
  const playlist = "#EXTM3U\n../secret.mp4\nv0/index.m3u8\n";
  assert.equal(await signPlaylistSegments(playlist, "", sign), playlist);
});
