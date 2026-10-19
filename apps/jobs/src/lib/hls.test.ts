import { afterAll, describe, expect, mock, spyOn, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
 * Поддельный ffmpeg — shell-скрипт, который быстро пишет куски так же, как
 * настоящий с temp_file (в .tmp, затем переименование), а заливка медленная.
 * Проверяем, что на диске не копится больше предела. Пауза процесса
 * (SIGSTOP) есть только в POSIX, поэтому на Windows тесты пропускаются.
 */

const MB = 1024 * 1024;
const work = await mkdtemp(join(tmpdir(), "stariva-hls-test-"));
const env = {
  HATCHET_CLIENT_TOKEN: "synthetic-token",
  STOREFRONT_URL: "http://localhost.test",
  JOBS_SECRET: "synthetic-jobs-secret-0123456789abcdef",
  FFMPEG_PATH: "",
  FFPROBE_PATH: "ffprobe",
};
mock.module("../env", () => ({ env }));
const { segmentAndUpload, segmentArgs } = await import("./hls");

const source = {
  videoCodec: "h264",
  audioCodec: "aac",
  rotation: 0,
  durationSeconds: 100,
};

/** Пишет скрипт поддельного ffmpeg: count кусков по size байт. */
async function fakeFfmpeg(name: string, count: number, size: number) {
  const path = join(work, `${name}.sh`);
  await writeFile(
    path,
    [
      "#!/bin/sh",
      "head -c 1024 /dev/zero > init.mp4",
      "i=0",
      `while [ $i -lt ${count} ]; do`,
      "  name=$(printf 'seg-%05d.m4s' $i)",
      `  head -c ${size} /dev/zero > "$name.tmp"`,
      '  mv "$name.tmp" "$name"',
      "  sleep 0.01",
      "  i=$((i + 1))",
      "done",
      "echo '#EXTM3U' > index.m3u8",
      "",
    ].join("\n"),
  );
  await chmod(path, 0o755);
  return path;
}

/** Медленный приёмник заливки: каждый PUT отвечает через delayMs. */
function uploadServer(delayMs: number) {
  const received: string[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      await req.arrayBuffer();
      await Bun.sleep(delayMs);
      received.push(new URL(req.url).pathname.slice(1));
      return new Response(null);
    },
  });
  const getTargets = async (files: string[]) =>
    Object.fromEntries(
      files.map((file) => [
        file,
        {
          url: `${server.url}${file}`,
          contentType: "application/octet-stream",
        },
      ]),
    );
  return { received, getTargets, stop: () => server.stop(true) };
}

/** Сколько байт лежит в папке; замеряем часто и запоминаем максимум. */
function watchPeak(dir: string) {
  let peak = 0;
  const timer = setInterval(() => {
    let bytes = 0;
    for (const name of readdirSync(dir)) {
      try {
        bytes += statSync(join(dir, name)).size;
      } catch {
        // Залили и удалили между readdir и stat
      }
    }
    peak = Math.max(peak, bytes);
  }, 5);
  return {
    stop: () => {
      clearInterval(timer);
      return peak;
    },
  };
}

afterAll(async () => {
  await rm(work, { recursive: true, force: true });
});

describe.skipIf(process.platform === "win32")("segmentAndUpload", () => {
  test("ставит ffmpeg на паузу и держит на диске не больше предела", async () => {
    const count = 48;
    const size = 256 * 1024;
    const pauseBytes = 3 * MB;
    env.FFMPEG_PATH = await fakeFfmpeg("fast", count, size);
    const dir = await mkdtemp(join(work, "run-"));
    const upload = uploadServer(250);
    const log = spyOn(console, "log");
    const peak = watchPeak(dir);
    try {
      const files = await segmentAndUpload(
        "http://source.test/video.mp4",
        source,
        dir,
        upload.getTargets,
        { pauseBytes, resumeBytes: 1 * MB, watchMs: 20 },
      );
      const peakBytes = peak.stop();

      expect(files).toBe(count + 2);
      expect(upload.received).toHaveLength(count + 2);
      expect(upload.received.at(-1)).toBe("index.m3u8");
      // Без паузы ffmpeg успевал бы записать почти всё (12 МБ). Запас на
      // кусок, который ffmpeg дописывает после проверки, и на шаг таймера
      expect(peakBytes).toBeLessThan(pauseBytes + 2 * MB);
      const lines = log.mock.calls.map((call) => String(call[0]));
      expect(lines.some((line) => line.includes("ffmpeg на паузе"))).toBe(true);
      expect(lines.some((line) => line.includes("ffmpeg продолжает"))).toBe(
        true,
      );
    } finally {
      peak.stop();
      log.mockRestore();
      upload.stop();
    }
  }, 30_000);

  test("не зависает, если один кусок больше предела", async () => {
    env.FFMPEG_PATH = await fakeFfmpeg("big", 4, 2 * MB);
    const dir = await mkdtemp(join(work, "run-"));
    const upload = uploadServer(50);
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      const files = await segmentAndUpload(
        "http://source.test/video.mp4",
        source,
        dir,
        upload.getTargets,
        { pauseBytes: 1 * MB, resumeBytes: 512 * 1024, watchMs: 20 },
      );
      expect(files).toBe(6);
    } finally {
      log.mockRestore();
      upload.stop();
    }
  }, 30_000);

  test("отмена убивает ffmpeg и на паузе", async () => {
    env.FFMPEG_PATH = await fakeFfmpeg("abort", 200, 256 * 1024);
    const dir = await mkdtemp(join(work, "run-"));
    const upload = uploadServer(500);
    const log = spyOn(console, "log").mockImplementation(() => {});
    const abort = new AbortController();
    setTimeout(() => abort.abort(new Error("task cancelled")), 1000);
    try {
      await expect(
        segmentAndUpload(
          "http://source.test/video.mp4",
          source,
          dir,
          upload.getTargets,
          {
            signal: abort.signal,
            pauseBytes: 1 * MB,
            resumeBytes: 512 * 1024,
            watchMs: 20,
          },
        ),
      ).rejects.toThrow();
      const lines = log.mock.calls.map((call) => String(call[0]));
      expect(lines.some((line) => line.includes("останавливаем ffmpeg"))).toBe(
        true,
      );
    } finally {
      log.mockRestore();
      upload.stop();
    }
  }, 30_000);
});

describe("segmentArgs", () => {
  const url = "https://bucket.example.test/lesson.mp4";
  const inputs = (args: string[]) =>
    args.flatMap((arg, i) => (arg === "-i" ? [args[i + 1]] : []));
  const maps = (args: string[]) =>
    args.flatMap((arg, i) => (arg === "-map" ? [args[i + 1]] : []));

  test("video and audio are read through separate inputs", () => {
    const args = segmentArgs(url, source);
    expect(inputs(args)).toEqual([url, url]);
    expect(maps(args)).toEqual(["0:v:0", "1:a:0"]);
    expect(args.filter((arg) => arg === "-reconnect")).toHaveLength(2);
  });

  test("a silent video gets a single input", () => {
    const args = segmentArgs(url, { ...source, audioCodec: null });
    expect(inputs(args)).toEqual([url]);
    expect(maps(args)).toEqual(["0:v:0"]);
  });
});
