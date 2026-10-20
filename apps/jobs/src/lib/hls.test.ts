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
const {
  masterPlaylist,
  measureBandwidth,
  planVariants,
  segmentAndUpload,
  segmentArgs,
} = await import("./hls");

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
  const bodies = new Map<string, string>();
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const body = await req.text();
      await Bun.sleep(delayMs);
      const name = new URL(req.url).pathname.slice(1);
      received.push(name);
      if (name.endsWith(".m3u8")) bodies.set(name, body);
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
  return { received, bodies, getTargets, stop: () => server.stop(true) };
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

describe("planVariants", () => {
  const sizes = (variants: ReturnType<typeof planVariants>) =>
    variants.map((v) => `${v.name} ${v.width}x${v.height}`);

  test("1080p H.264 копируется, ниже — 720p и 480p", () => {
    const variants = planVariants({ ...source, width: 1920, height: 1080 });
    expect(sizes(variants)).toEqual([
      "v0 1920x1080",
      "v1 1280x720",
      "v2 854x480",
    ]);
    expect(variants[0]?.codecArgs).toEqual(["-c:v", "copy", "-c:a", "copy"]);
    const low = variants[2]?.codecArgs ?? [];
    expect(low).toContain("scale=854:480");
    expect(low).toContain("1000k");
    // Ключевые кадры по границам кусков — у всех перекодированных качеств
    expect(low).toContain("expr:gte(t,n_forced*6)");
  });

  test("повёрнутое видео с телефона: перекодирование, короткая сторона — ширина", () => {
    const variants = planVariants({
      videoCodec: "hevc",
      audioCodec: "aac",
      rotation: -90,
      durationSeconds: 60,
      width: 3840,
      height: 2160,
    });
    expect(sizes(variants)).toEqual([
      "v0 1080x1920",
      "v1 720x1280",
      "v2 480x854",
    ]);
    expect(variants[0]?.codecArgs).toContain("libx264");
    expect(variants[0]?.codecArgs).toContain("scale=1080:1920");
  });

  test("720p — только 480p ниже; размер неизвестен — одно качество", () => {
    expect(
      sizes(planVariants({ ...source, width: 1280, height: 720 })),
    ).toEqual(["v0 1280x720", "v1 854x480"]);
    expect(sizes(planVariants(source))).toEqual(["v0 nullxnull"]);
  });
});

test("master.m3u8 начинается с 720p и перечисляет все качества", () => {
  const variants = planVariants({ ...source, width: 1920, height: 1080 });
  const playlist = masterPlaylist(variants, [
    { peak: 7_000_000, average: 6_300_000 },
    { peak: 2_900_000.4, average: 2_600_000 },
    { peak: 1_200_000, average: 1_100_000 },
  ]);
  expect(playlist).toBe(
    [
      "#EXTM3U",
      "#EXT-X-INDEPENDENT-SEGMENTS",
      "#EXT-X-STREAM-INF:BANDWIDTH=2900000,AVERAGE-BANDWIDTH=2600000,RESOLUTION=1280x720",
      "v1/index.m3u8",
      "#EXT-X-STREAM-INF:BANDWIDTH=7000000,AVERAGE-BANDWIDTH=6300000,RESOLUTION=1920x1080",
      "v0/index.m3u8",
      "#EXT-X-STREAM-INF:BANDWIDTH=1200000,AVERAGE-BANDWIDTH=1100000,RESOLUTION=854x480",
      "v2/index.m3u8",
      "",
    ].join("\n"),
  );
});

test("битрейт качества — по кускам из плейлиста", () => {
  const playlist = [
    "#EXTM3U",
    '#EXT-X-MAP:URI="init.mp4"',
    "#EXTINF:6.000000,",
    "seg-00000.m4s",
    "#EXTINF:4.000000,",
    "seg-00001.m4s",
    "#EXT-X-ENDLIST",
  ].join("\n");
  const sizes = new Map([
    ["seg-00000.m4s", 600_000],
    ["seg-00001.m4s", 1_000_000],
  ]);
  expect(
    measureBandwidth(playlist, sizes, { durationSeconds: 10, bitrate: null }),
  ).toEqual({ peak: 2_000_000, average: 1_280_000 });
  // Плейлист не разобрать — делим залитое на длину видео
  expect(
    measureBandwidth("#EXTM3U", sizes, { durationSeconds: 10, bitrate: null }),
  ).toEqual({ peak: 1_280_000, average: 1_280_000 });
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

      // Размер кадра неизвестен — одно качество в v0/ и master.m3u8
      expect(files).toBe(count + 3);
      expect(upload.received).toHaveLength(count + 3);
      expect(upload.received.at(-2)).toBe("v0/index.m3u8");
      expect(upload.received.at(-1)).toBe("master.m3u8");
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
      expect(files).toBe(7);
    } finally {
      log.mockRestore();
      upload.stop();
    }
  }, 30_000);

  test("режет каждое качество в свою папку, master.m3u8 — последним", async () => {
    env.FFMPEG_PATH = await fakeFfmpeg("variants", 3, 1024);
    const dir = await mkdtemp(join(work, "run-"));
    const upload = uploadServer(0);
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      const files = await segmentAndUpload(
        "http://source.test/video.mp4",
        { ...source, width: 1920, height: 1080 },
        dir,
        upload.getTargets,
      );
      expect(files).toBe(3 * 5 + 1);
      for (const name of ["v0", "v1", "v2"]) {
        expect(upload.received).toContain(`${name}/seg-00002.m4s`);
        expect(upload.received).toContain(`${name}/init.mp4`);
        // Плейлист качества — после его кусков
        expect(upload.received.indexOf(`${name}/index.m3u8`)).toBeGreaterThan(
          upload.received.indexOf(`${name}/seg-00002.m4s`),
        );
      }
      expect(upload.received.at(-1)).toBe("master.m3u8");
      const master = upload.bodies.get("master.m3u8") ?? "";
      expect(master.split("\n").filter((l) => l.endsWith(".m3u8"))).toEqual([
        "v1/index.m3u8",
        "v0/index.m3u8",
        "v2/index.m3u8",
      ]);
      expect(readdirSync(dir)).toEqual([]);
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
  const top = (probe: Parameters<typeof planVariants>[0]) => {
    const [variant] = planVariants(probe);
    if (!variant) throw new Error("нет качеств");
    return variant;
  };

  test("video and audio are read through separate inputs", () => {
    const args = segmentArgs(url, source, top(source));
    expect(inputs(args)).toEqual([url, url]);
    expect(maps(args)).toEqual(["0:v:0", "1:a:0"]);
    expect(args.filter((arg) => arg === "-reconnect")).toHaveLength(2);
  });

  test("a silent video gets a single input", () => {
    const silent = { ...source, audioCodec: null };
    const args = segmentArgs(url, silent, top(silent));
    expect(inputs(args)).toEqual([url]);
    expect(maps(args)).toEqual(["0:v:0"]);
  });
});
