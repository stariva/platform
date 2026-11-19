import { expect, test } from "bun:test";
import { nativeHlsQualities, qualityLabel } from "./video-quality";

test("quality labels use the short side for portrait and landscape video", () => {
  expect(qualityLabel(720, 1280)).toBe("720p");
  expect(qualityLabel(1920, 1080)).toBe("1080p");
});

test("native HLS variants resolve relative URLs and keep their original indices", () => {
  const master = [
    "#EXTM3U",
    "#EXT-X-STREAM-INF:BANDWIDTH=2900000,RESOLUTION=720x1280",
    "v0/index.m3u8",
    "#EXT-X-STREAM-INF:BANDWIDTH=6100000,RESOLUTION=1080x1920",
    "v1/index.m3u8",
    "#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=480x854",
    "v2/index.m3u8",
  ].join("\n");
  expect(
    nativeHlsQualities(master, "https://stariva.ru/hls/token/master.m3u8"),
  ).toEqual([
    {
      label: "1080p",
      index: 1,
      url: "https://stariva.ru/hls/token/v1/index.m3u8",
    },
    {
      label: "720p",
      index: 0,
      url: "https://stariva.ru/hls/token/v0/index.m3u8",
    },
    {
      label: "480p",
      index: 2,
      url: "https://stariva.ru/hls/token/v2/index.m3u8",
    },
  ]);
});

test("native HLS variants skip broken entries and keep valid ones", () => {
  const master = [
    "#EXTM3U",
    "#EXT-X-STREAM-INF:BANDWIDTH=2900000,RESOLUTION=720x1280",
    "http://[",
    "#EXT-X-STREAM-INF:BANDWIDTH=6100000,RESOLUTION=1080x1920",
    "v1/index.m3u8",
  ].join("\n");
  expect(
    nativeHlsQualities(master, "https://stariva.ru/hls/token/master.m3u8"),
  ).toEqual([
    {
      label: "1080p",
      index: 0,
      url: "https://stariva.ru/hls/token/v1/index.m3u8",
    },
  ]);
});
