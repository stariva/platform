import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "../env";

/** Длина куска, секунды. Короче — быстрее старт и перемотка, но больше файлов. */
const SEGMENT_SECONDS = 6;
// Сколько кусков заливаем одновременно
const UPLOAD_CONCURRENCY = 6;
const UPLOAD_ATTEMPTS = 3;

export interface ProbeResult {
  videoCodec: string | null;
  audioCodec: string | null;
  /** Поворот из метаданных телефона: при копировании без перекодирования он теряется. */
  rotation: number;
  durationSeconds: number;
}

/** Запускает ffmpeg/ffprobe; при ошибке — хвост stderr в тексте исключения. */
function run(command: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      // Держим только хвост: ffmpeg пишет прогресс всё время работы
      stderr = (stderr + chunk).slice(-4000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} exited with ${code}: ${stderr}`));
    });
  });
}

export async function probe(sourceUrl: string): Promise<ProbeResult> {
  // Полный вывод, а не -show_entries: названия секций меняются между версиями
  const out = await run(env.FFPROBE_PATH, [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    sourceUrl,
  ]);
  const data = JSON.parse(out) as {
    streams?: {
      codec_type?: string;
      codec_name?: string;
      tags?: { rotate?: string };
      side_data_list?: { rotation?: number }[];
    }[];
    format?: { duration?: string };
  };
  const video = data.streams?.find((s) => s.codec_type === "video");
  const audio = data.streams?.find((s) => s.codec_type === "audio");
  // Новые ffprobe пишут поворот в side_data, старые — в теги
  const rotation =
    video?.side_data_list?.find((d) => d.rotation)?.rotation ??
    video?.tags?.rotate ??
    0;
  return {
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
    rotation: Number(rotation) || 0,
    durationSeconds: Number(data.format?.duration ?? 0),
  };
}

/**
 * Аргументы кодеков. H.264 + AAC (обычный MP4 с камеры или из монтажки)
 * копируем как есть — быстро и без потери качества. Остальное (HEVC с
 * iPhone, WebM, повёрнутое видео) перекодируем в H.264/AAC: их понимают все
 * браузеры.
 */
export function codecArgs(source: ProbeResult): string[] {
  const copyVideo = source.videoCodec === "h264" && source.rotation === 0;
  const copyAudio = source.audioCodec === null || source.audioCodec === "aac";
  return [
    ...(copyVideo
      ? ["-c:v", "copy"]
      : [
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "21",
          "-pix_fmt",
          "yuv420p",
          // Ключевой кадр в начале каждого куска — иначе куски выйдут неровными
          "-force_key_frames",
          `expr:gte(t,n_forced*${SEGMENT_SECONDS})`,
        ]),
    ...(copyAudio ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "160k", "-ac", "2"]),
  ];
}

/** Режет видео в HLS (fMP4) в папку `dir`: index.m3u8, init.mp4, seg-NNNNN.m4s. */
export async function segment(
  sourceUrl: string,
  source: ProbeResult,
  dir: string,
): Promise<void> {
  await run(
    env.FFMPEG_PATH,
    [
      "-hide_banner",
      "-nostdin",
      "-y",
      "-i",
      sourceUrl,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      ...codecArgs(source),
      "-f",
      "hls",
      "-hls_time",
      String(SEGMENT_SECONDS),
      "-hls_playlist_type",
      "vod",
      "-hls_segment_type",
      "fmp4",
      "-hls_fmp4_init_filename",
      "init.mp4",
      "-hls_segment_filename",
      "seg-%05d.m4s",
      "-hls_flags",
      "independent_segments",
      "index.m3u8",
    ],
    dir,
  );
}

type UploadTargets = Record<string, { url: string; contentType: string }>;

async function putFile(file: string, path: string, target: UploadTargets[string]) {
  const body = await readFile(path);
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(target.url, {
      method: "PUT",
      headers: { "Content-Type": target.contentType },
      body,
      signal: AbortSignal.timeout(120_000),
    }).catch((error: unknown) => error as Error);
    if (!(res instanceof Error) && res.ok) return;
    if (attempt >= UPLOAD_ATTEMPTS) {
      const reason = res instanceof Error ? res.message : `HTTP ${res.status}`;
      throw new Error(`upload ${file}: ${reason}`);
    }
    await new Promise((r) => setTimeout(r, attempt * 2000));
  }
}

/**
 * Заливает файлы из `dir`. Ссылки на загрузку выдаёт сайт пачками.
 * Плейлист идёт последним: по нему сайт понимает, что всё на месте.
 */
export async function uploadDir(
  dir: string,
  getTargets: (files: string[]) => Promise<UploadTargets>,
): Promise<number> {
  const files = (await readdir(dir)).sort();
  const playlistLast = [
    ...files.filter((f) => f !== "index.m3u8"),
    ...files.filter((f) => f === "index.m3u8"),
  ];
  if (!files.includes("index.m3u8")) throw new Error("ffmpeg did not write index.m3u8");

  for (let start = 0; start < playlistLast.length; start += 500) {
    const batch = playlistLast.slice(start, start + 500);
    const targets = await getTargets(batch);
    // Плейлист — строго после всех кусков, поэтому его не распараллеливаем
    const chunks = batch.filter((f) => f !== "index.m3u8");
    let next = 0;
    await Promise.all(
      Array.from({ length: UPLOAD_CONCURRENCY }, async () => {
        while (next < chunks.length) {
          const file = chunks[next++] as string;
          const target = targets[file];
          if (!target) throw new Error(`no upload url for ${file}`);
          await putFile(file, join(dir, file), target);
        }
      }),
    );
    const playlist = targets["index.m3u8"];
    if (batch.includes("index.m3u8")) {
      if (!playlist) throw new Error("no upload url for index.m3u8");
      await putFile("index.m3u8", join(dir, "index.m3u8"), playlist);
    }
  }
  return files.length;
}

/** Временная папка под нарезку; удаляется в любом случае. */
export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "stariva-hls-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
