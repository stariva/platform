import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "../env";

/** Длина куска, секунды. Короче — быстрее старт и перемотка, но больше файлов. */
const SEGMENT_SECONDS = 6;
// Сколько кусков заливаем одновременно и сколько ссылок берём у сайта за раз
const UPLOAD_CONCURRENCY = 3;
const UPLOAD_BATCH = 12;
const UPLOAD_ATTEMPTS = 3;
// Очередь готовых кусков на диске: больше — ffmpeg ждёт, меньше — продолжает
const PAUSE_BACKLOG = 12;
const RESUME_BACKLOG = 3;
// Как часто смотрим, не появились ли новые куски
const POLL_MS = 1000;
const SEGMENT_FILE = /^seg-\d{5}\.m4s$/;

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
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
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
    ...(copyAudio
      ? ["-c:a", "copy"]
      : ["-c:a", "aac", "-b:a", "160k", "-ac", "2"]),
  ];
}

/** Аргументы ffmpeg: HLS (fMP4) в текущую папку — index.m3u8, init.mp4, seg-NNNNN.m4s. */
function segmentArgs(sourceUrl: string, source: ProbeResult): string[] {
  return [
    "-hide_banner",
    "-nostdin",
    "-loglevel",
    "error",
    "-y",
    // Исходник читается из бакета по HTTPS: обрыв или пауза (см. ниже) не
    // должны ронять нарезку
    "-reconnect",
    "1",
    "-reconnect_on_network_error",
    "1",
    "-reconnect_delay_max",
    "30",
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
    // temp_file: кусок пишется в .tmp и переименовывается целиком, поэтому
    // любой seg-*.m4s в папке уже можно заливать
    "-hls_flags",
    "independent_segments+temp_file",
    "index.m3u8",
  ];
}

type UploadTargets = Record<string, { url: string; contentType: string }>;

async function putFile(
  file: string,
  path: string,
  target: UploadTargets[string],
) {
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

/** Заливает файлы по ссылкам от сайта, по несколько сразу, и удаляет их с диска. */
async function uploadAndRemove(
  dir: string,
  files: string[],
  getTargets: (files: string[]) => Promise<UploadTargets>,
) {
  const targets = await getTargets(files);
  let next = 0;
  await Promise.all(
    Array.from({ length: UPLOAD_CONCURRENCY }, async () => {
      while (next < files.length) {
        const file = files[next++] as string;
        const target = targets[file];
        if (!target) throw new Error(`no upload url for ${file}`);
        await putFile(file, join(dir, file), target);
        await rm(join(dir, file), { force: true });
      }
    }),
  );
}

/**
 * Режет видео и сразу заливает готовые куски, удаляя их с диска. На диске и
 * в памяти одновременно лежит лишь несколько кусков, а не всё видео: под
 * воркера маленький, и раньше его убивали посреди заливки.
 *
 * Если заливка не поспевает за ffmpeg (копирование без перекодирования режет
 * быстрее, чем льётся сеть), ffmpeg ставится на паузу, пока очередь не
 * разойдётся. init.mp4 и плейлист заливаются в самом конце, плейлист —
 * последним: по нему сайт понимает, что всё на месте.
 *
 * Возвращает число залитых файлов.
 */
export async function segmentAndUpload(
  sourceUrl: string,
  source: ProbeResult,
  dir: string,
  getTargets: (files: string[]) => Promise<UploadTargets>,
  signal?: AbortSignal,
): Promise<number> {
  const child = spawn(env.FFMPEG_PATH, segmentArgs(sourceUrl, source), {
    cwd: dir,
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk).slice(-4000);
  });
  let exitCode: number | null | undefined;
  const exited = new Promise<void>((resolve) => {
    child.on("close", (code) => {
      exitCode = code;
      resolve();
    });
    child.on("error", (error) => {
      stderr += String(error);
      exitCode = -1;
      resolve();
    });
  });

  // Пауза процесса есть только в POSIX; на Windows (локальная проверка) без неё
  const canPause = process.platform !== "win32";
  let paused = false;
  const setPaused = (value: boolean) => {
    if (!canPause || paused === value || exitCode !== undefined) return;
    child.kill(value ? "SIGSTOP" : "SIGCONT");
    paused = value;
  };
  const stop = () => {
    if (exitCode !== undefined) return;
    child.kill("SIGKILL"); // снимает и с паузы
  };
  signal?.addEventListener("abort", stop, { once: true });

  let uploaded = 0;
  try {
    for (;;) {
      signal?.throwIfAborted();
      const finished = exitCode !== undefined;
      const ready = (await readdir(dir))
        .filter((f) => SEGMENT_FILE.test(f))
        .sort();

      if (ready.length >= PAUSE_BACKLOG) setPaused(true);
      else if (ready.length <= RESUME_BACKLOG) setPaused(false);

      if (ready.length > 0) {
        const batch = ready.slice(0, UPLOAD_BATCH);
        await uploadAndRemove(dir, batch, getTargets);
        uploaded += batch.length;
        continue;
      }
      if (finished) break;
      await Promise.race([exited, sleep(POLL_MS)]);
    }

    if (exitCode !== 0) {
      throw new Error(`ffmpeg exited with ${exitCode}: ${stderr}`);
    }
    await uploadAndRemove(dir, ["init.mp4"], getTargets);
    await uploadAndRemove(dir, ["index.m3u8"], getTargets);
    return uploaded + 2;
  } finally {
    signal?.removeEventListener("abort", stop);
    stop();
    await exited;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Временная папка под нарезку; удаляется в любом случае. */
export async function withTempDir<T>(
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "stariva-hls-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
