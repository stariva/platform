import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  statfs,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "../env";

/**
 * Версия нарезки, которую делает воркер: несколько качеств и master.m3u8.
 * Сайт по ней отдаёт воркеру и готовые видео в одно качество — перерезать.
 */
export const HLS_VERSION = 2;
/** Длина куска, секунды. Короче — быстрее старт и перемотка, но больше файлов. */
const SEGMENT_SECONDS = 6;
/**
 * Качества ниже исходника: короткая сторона кадра, видео и звук. Телефон на
 * медленной сети берёт нижнее; 6 Мбит/с исходника на мобильном интернете
 * не успевали грузиться. Ступень берётся, только если исходник больше неё.
 */
const LADDER = [
  { short: 720, videoKbps: 2500, audioKbps: 128 },
  { short: 480, videoKbps: 1000, audioKbps: 96 },
] as const;
/** Выше этого верхнее качество не поднимаем: 4K на уроке ни к чему. */
const MAX_SHORT_SIDE = 1080;
// Сколько кусков заливаем одновременно и сколько ссылок берём у сайта за раз
const UPLOAD_CONCURRENCY = 3;
const UPLOAD_BATCH = 12;
const UPLOAD_ATTEMPTS = 3;
const MB = 1024 * 1024;
// Сколько нарезки может лежать на диске (все файлы папки, включая
// недописанный кусок и те, что сейчас льются): больше — ffmpeg на паузе,
// пока заливка не опустит очередь до RESUME_BYTES
const PAUSE_BYTES = 48 * MB;
const RESUME_BYTES = 16 * MB;
// Как часто смотрим на диск. Отдельным таймером, а не между пачками
// заливки: с -c copy ffmpeg пишет десятки мегабайт в секунду и за одну
// пачку успевал набить сотни мегабайт
const WATCH_MS = 200;
// Как часто пишем в лог строку о ходе нарезки
const PROGRESS_LOG_MS = 10_000;
// Как часто смотрим, не появились ли новые куски
const POLL_MS = 1000;
const SEGMENT_FILE = /^seg-\d{5}\.m4s$/;

export interface ProbeResult {
  videoCodec: string | null;
  audioCodec: string | null;
  /** Поворот из метаданных телефона: при копировании без перекодирования он теряется. */
  rotation: number;
  durationSeconds: number;
  /** Размер кадра до поворота; 0 — ffprobe не сказал. */
  width?: number;
  height?: number;
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
      width?: number;
      height?: number;
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
    width: Number(video?.width) || 0,
    height: Number(video?.height) || 0,
  };
}

/** Одно качество нарезки: подпапка в бакете, размер кадра и кодеки. */
export interface Variant {
  /** Подпапка: v0 — верхнее качество, дальше ниже. */
  name: string;
  /** Размер кадра после поворота; null — неизвестен. */
  width: number | null;
  height: number | null;
  /** Заявленный битрейт видео и звука, бит/с; null — как у исходника. */
  bitrate: number | null;
  codecArgs: string[];
}

const keyFrameArgs = [
  // Ключевой кадр в начале каждого куска — иначе куски выйдут неровными, а
  // у разных качеств — несовпадающими, и плееру труднее между ними прыгать
  "-force_key_frames",
  `expr:gte(t,n_forced*${SEGMENT_SECONDS})`,
];

/** Кадр, уменьшенный до короткой стороны short; стороны чётные (для H.264). */
function scaled(width: number, height: number, short: number) {
  const k = short / Math.min(width, height);
  const even = (n: number) => Math.max(2, Math.round((n * k) / 2) * 2);
  return { width: even(width), height: even(height) };
}

/**
 * Качества нарезки. Верхнее — исходник: H.264 + AAC (обычный MP4 с камеры
 * или из монтажки) копируем как есть — быстро и без потери качества.
 * Остальное (HEVC с iPhone, WebM, повёрнутое видео, больше 1080p)
 * перекодируем в H.264/AAC: их понимают все браузеры. Ниже — 720p и 480p
 * (libx264, заданный битрейт), если исходник больше. Размер кадра неизвестен
 * — только верхнее качество.
 */
export function planVariants(source: ProbeResult): Variant[] {
  const turned = Math.abs(source.rotation) % 180 === 90;
  const rawWidth = source.width ?? 0;
  const rawHeight = source.height ?? 0;
  const known = rawWidth > 0 && rawHeight > 0;
  // ffmpeg поворачивает кадр при перекодировании, размеры — уже повёрнутые
  const width = turned ? rawHeight : rawWidth;
  const height = turned ? rawWidth : rawHeight;
  const short = Math.min(width, height);

  const copyVideo =
    source.videoCodec === "h264" &&
    source.rotation === 0 &&
    (!known || short <= MAX_SHORT_SIDE);
  const copyAudio = source.audioCodec === null || source.audioCodec === "aac";
  const top =
    known && short > MAX_SHORT_SIDE
      ? scaled(width, height, MAX_SHORT_SIDE)
      : { width, height };
  const variants: Variant[] = [
    {
      name: "v0",
      width: known ? top.width : null,
      height: known ? top.height : null,
      bitrate: null,
      codecArgs: [
        ...(copyVideo
          ? ["-c:v", "copy"]
          : [
              ...(known && short > MAX_SHORT_SIDE
                ? ["-vf", `scale=${top.width}:${top.height}`]
                : []),
              "-c:v",
              "libx264",
              "-preset",
              "veryfast",
              "-crf",
              "21",
              "-pix_fmt",
              "yuv420p",
              ...keyFrameArgs,
            ]),
        ...(copyAudio
          ? ["-c:a", "copy"]
          : ["-c:a", "aac", "-b:a", "160k", "-ac", "2"]),
      ],
    },
  ];
  if (!known) return variants;

  for (const rung of LADDER) {
    if (Math.min(top.width, top.height) <= rung.short) continue;
    const size = scaled(width, height, rung.short);
    const kbps = rung.videoKbps;
    variants.push({
      name: `v${variants.length}`,
      ...size,
      bitrate: (kbps + rung.audioKbps) * 1000,
      codecArgs: [
        "-vf",
        `scale=${size.width}:${size.height}`,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-profile:v",
        "main",
        "-b:v",
        `${kbps}k`,
        // Потолок и буфер: без них на сложных сценах битрейт скачет вдвое
        "-maxrate",
        `${Math.round(kbps * 1.1)}k`,
        "-bufsize",
        `${kbps * 2}k`,
        "-pix_fmt",
        "yuv420p",
        ...keyFrameArgs,
        "-c:a",
        "aac",
        "-b:a",
        `${rung.audioKbps}k`,
        "-ac",
        "2",
      ],
    });
  }
  return variants;
}

/** Сколько бит/с нужно качеству: пик по кускам и в среднем. */
export interface VariantBandwidth {
  peak: number;
  average: number;
}

/**
 * master.m3u8: список качеств со ссылками на их плейлисты. Первым идёт
 * среднее (720p): с него начинает Safari, а hls.js сам выбирает по скорости.
 */
export function masterPlaylist(
  variants: Variant[],
  bandwidth: VariantBandwidth[],
): string {
  const order = variants.map((_, i) => i);
  if (order.length > 1) order.unshift(...order.splice(1, 1));
  const lines = ["#EXTM3U", "#EXT-X-INDEPENDENT-SEGMENTS"];
  for (const i of order) {
    const variant = variants[i] as Variant;
    const rate = bandwidth[i] as VariantBandwidth;
    const attrs = [
      `BANDWIDTH=${Math.max(1, Math.round(rate.peak))}`,
      `AVERAGE-BANDWIDTH=${Math.max(1, Math.round(rate.average))}`,
    ];
    if (variant.width && variant.height) {
      attrs.push(`RESOLUTION=${variant.width}x${variant.height}`);
    }
    lines.push(
      `#EXT-X-STREAM-INF:${attrs.join(",")}`,
      `${variant.name}/index.m3u8`,
    );
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Битрейт качества по залитым кускам: длительности из его плейлиста, размеры
 * — что залили. Если плейлист не разобрать, делим всё на длину видео.
 */
export function measureBandwidth(
  playlist: string,
  sizes: Map<string, number>,
  fallback: { durationSeconds: number; bitrate: number | null },
): VariantBandwidth {
  let peak = 0;
  let bits = 0;
  let seconds = 0;
  let duration: number | null = null;
  for (const line of playlist.split(/\r?\n/)) {
    const extinf = line.match(/^#EXTINF:([\d.]+)/);
    if (extinf) {
      duration = Number(extinf[1]);
      continue;
    }
    const size = sizes.get(line.trim());
    if (duration && size !== undefined) {
      peak = Math.max(peak, (size * 8) / duration);
      bits += size * 8;
      seconds += duration;
    }
    if (!line.startsWith("#")) duration = null;
  }
  if (seconds > 0) return { peak, average: bits / seconds };

  const total = [...sizes.values()].reduce((sum, size) => sum + size, 0);
  const average =
    fallback.durationSeconds > 0
      ? (total * 8) / fallback.durationSeconds
      : (fallback.bitrate ?? 1);
  return { peak: average, average };
}

/** Аргументы ffmpeg: HLS (fMP4) в текущую папку — index.m3u8, init.mp4, seg-NNNNN.m4s. */
function segmentArgs(sourceUrl: string, variant: Variant): string[] {
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
    ...variant.codecArgs,
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

/** Заливает файл по ссылке; возвращает его размер. */
async function putFile(
  file: string,
  path: string,
  target: UploadTargets[string],
): Promise<number> {
  const body = await readFile(path);
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(target.url, {
      method: "PUT",
      headers: { "Content-Type": target.contentType },
      body,
      signal: AbortSignal.timeout(120_000),
    }).catch((error: unknown) => error as Error);
    if (!(res instanceof Error) && res.ok) return body.length;
    if (attempt >= UPLOAD_ATTEMPTS) {
      const reason = res instanceof Error ? res.message : `HTTP ${res.status}`;
      throw new Error(`upload ${file}: ${reason}`);
    }
    await new Promise((r) => setTimeout(r, attempt * 2000));
  }
}

/**
 * Заливает файлы по ссылкам от сайта, по несколько сразу, и удаляет их с
 * диска. В бакете файл ложится под именем `remoteDir + имя` (папка качества).
 * Размеры залитого пишет в sizes, если передан. Возвращает число залитых байт.
 */
async function uploadAndRemove(
  dir: string,
  files: string[],
  getTargets: (files: string[]) => Promise<UploadTargets>,
  remoteDir = "",
  sizes?: Map<string, number>,
): Promise<number> {
  const targets = await getTargets(files.map((file) => remoteDir + file));
  let next = 0;
  let bytes = 0;
  await Promise.all(
    Array.from({ length: UPLOAD_CONCURRENCY }, async () => {
      while (next < files.length) {
        const file = files[next++] as string;
        const remote = remoteDir + file;
        const target = targets[remote];
        if (!target) throw new Error(`no upload url for ${remote}`);
        const size = await putFile(remote, join(dir, file), target);
        sizes?.set(file, size);
        bytes += size;
        await rm(join(dir, file), { force: true });
      }
    }),
  );
  return bytes;
}

/** Сколько лежит в папке нарезки: все файлы и отдельно готовые куски. */
async function scanDir(dir: string) {
  const names = await readdir(dir);
  const sizes = await Promise.all(
    // Файл могли залить и удалить между readdir и stat
    names.map((name) =>
      stat(join(dir, name)).then(
        (s) => s.size,
        () => 0,
      ),
    ),
  );
  return {
    bytes: sizes.reduce((sum, size) => sum + size, 0),
    ready: names.filter((name) => SEGMENT_FILE.test(name)).sort(),
  };
}

const mb = (bytes: number) => `${(bytes / MB).toFixed(1)} МБ`;

/**
 * Память и место — то, из-за чего под убивают. Чего не прочитать (не Linux,
 * нет cgroup v2), просто нет в строке.
 */
async function resources(dir: string, ffmpegPid: number | undefined) {
  const parts = [`node ${mb(process.memoryUsage().rss)}`];
  const read = (path: string) =>
    readFile(path, "utf8").then(
      (s) => s.trim(),
      () => null,
    );
  if (ffmpegPid) {
    const rss = (await read(`/proc/${ffmpegPid}/status`))?.match(
      /VmRSS:\s+(\d+) kB/,
    )?.[1];
    if (rss) parts.push(`ffmpeg ${mb(Number(rss) * 1024)}`);
  }
  const used = await read("/sys/fs/cgroup/memory.current");
  if (used) {
    const max = await read("/sys/fs/cgroup/memory.max");
    const limit = max && max !== "max" ? ` из ${mb(Number(max))}` : "";
    parts.push(`контейнер ${mb(Number(used))}${limit}`);
  }
  const fs = await statfs(dir).catch(() => null);
  if (fs) parts.push(`свободно ${mb(fs.bavail * fs.bsize)}`);
  return parts.join(", ");
}

export interface SegmentOptions {
  /** Отмена: ffmpeg убивается, заливка прерывается. */
  signal?: AbortSignal;
  /** Байт на диске, при которых ffmpeg встаёт на паузу. */
  pauseBytes?: number;
  /** Байт на диске, при которых ffmpeg продолжает. */
  resumeBytes?: number;
  /** Как часто смотреть на диск, мс. */
  watchMs?: number;
}

/**
 * Режет видео в одно качество и сразу заливает готовые куски в его папку
 * (`v0/`, `v1/`…), удаляя их с диска. На диске и в памяти одновременно
 * лежит лишь несколько кусков, а не всё видео: под воркера маленький, и
 * раньше его убивали посреди заливки.
 *
 * Если заливка не поспевает за ffmpeg (копирование без перекодирования режет
 * быстрее, чем льётся сеть), ffmpeg ставится на паузу, как только на диске
 * набирается pauseBytes, и продолжает, когда заливка опустит очередь до
 * resumeBytes. Диск проверяет отдельный таймер, независимо от заливки.
 * init.mp4 и плейлист заливаются в самом конце, плейлист — последним: по
 * нему сайт понимает, что всё на месте.
 *
 * Пишет в лог старт, паузы и выход ffmpeg, а раз в PROGRESS_LOG_MS — ход
 * заливки, объём на диске и память: если под убьют, по последней строке
 * видно, на чём.
 *
 * Возвращает число залитых файлов и битрейт качества для master.m3u8.
 */
export async function cutVariant(
  sourceUrl: string,
  source: ProbeResult,
  variant: Variant,
  dir: string,
  getTargets: (files: string[]) => Promise<UploadTargets>,
  {
    signal,
    pauseBytes = PAUSE_BYTES,
    resumeBytes = RESUME_BYTES,
    watchMs = WATCH_MS,
  }: SegmentOptions = {},
): Promise<{ files: number; bandwidth: VariantBandwidth }> {
  const startedAt = Date.now();
  const seconds = () => `${Math.round((Date.now() - startedAt) / 1000)} с`;
  const remoteDir = `${variant.name}/`;
  const sizes = new Map<string, number>();
  const child = spawn(env.FFMPEG_PATH, segmentArgs(sourceUrl, variant), {
    cwd: dir,
    stdio: ["ignore", "ignore", "pipe"],
  });
  const size = variant.height ? `${variant.width}x${variant.height}` : "?";
  console.log(
    `[hls] ${variant.name}: ffmpeg ${child.pid ?? "?"} запущен: ` +
      `${source.videoCodec ?? "?"}/${source.audioCodec ?? "-"} → ${size}, ` +
      `${Math.round(source.durationSeconds)} с видео, ` +
      `${variant.codecArgs.includes("libx264") ? "перекодирование" : "копирование"}, ` +
      `пауза при ${mb(pauseBytes)} на диске`,
  );
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk).slice(-4000);
  });
  let exitCode: number | null | undefined;
  const exited = new Promise<void>((resolve) => {
    child.on("close", (code, exitSignal) => {
      exitCode = code;
      console.log(
        `[hls] ffmpeg вышел через ${seconds()}: код ${code}` +
          (exitSignal ? `, сигнал ${exitSignal}` : ""),
      );
      resolve();
    });
    child.on("error", (error) => {
      stderr += String(error);
      exitCode = -1;
      resolve();
    });
  });

  let uploadedFiles = 0;
  let uploadedBytes = 0;
  let disk = { bytes: 0, ready: [] as string[] };
  let peakBytes = 0;
  const progress = () =>
    `залито ${uploadedFiles} файлов / ${mb(uploadedBytes)}, ` +
    `на диске ${mb(disk.bytes)} (${disk.ready.length} кусков)`;

  // Пауза процесса есть только в POSIX; на Windows (локальная проверка) без неё
  const canPause = process.platform !== "win32";
  let paused = false;
  const setPaused = (value: boolean) => {
    if (!canPause || paused === value || exitCode !== undefined) return;
    child.kill(value ? "SIGSTOP" : "SIGCONT");
    paused = value;
    console.log(
      `[hls] ${seconds()}: ffmpeg ${value ? "на паузе" : "продолжает"}, ${progress()}`,
    );
  };
  let stopped = false;
  const stop = () => {
    if (exitCode !== undefined || stopped) return;
    stopped = true;
    console.log(`[hls] ${seconds()}: останавливаем ffmpeg, ${progress()}`);
    child.kill("SIGKILL"); // снимает и с паузы
  };
  signal?.addEventListener("abort", stop, { once: true });

  const checkDisk = async () => {
    const scan = await scanDir(dir);
    disk = scan;
    peakBytes = Math.max(peakBytes, scan.bytes);
    // Готовых кусков нет — заливать нечего, и пауза очередь не разгрузит
    // (например, один кусок длиннее предела): ffmpeg должен дописать его
    if (scan.ready.length === 0 || scan.bytes <= resumeBytes) setPaused(false);
    else if (scan.bytes >= pauseBytes) setPaused(true);
    return scan;
  };
  // Таймер не запускает новую проверку, пока не закончилась прошлая
  let watching: Promise<unknown> | undefined;
  const watcher = setInterval(() => {
    watching ??= checkDisk()
      .catch((error: unknown) => {
        console.error("[hls] не удалось проверить диск:", error);
      })
      .finally(() => {
        watching = undefined;
      });
  }, watchMs);
  const progressLog = setInterval(async () => {
    try {
      const state = paused ? "на паузе" : "работает";
      const pid = exitCode === undefined ? child.pid : undefined;
      console.log(
        `[hls] ${seconds()}: ${progress()}, пик ${mb(peakBytes)}, ` +
          `ffmpeg ${pid ? state : "закончил"}; ${await resources(dir, pid)}`,
      );
    } catch {
      // Лог хода работы не должен ронять воркер
    }
  }, PROGRESS_LOG_MS);

  try {
    for (;;) {
      signal?.throwIfAborted();
      const finished = exitCode !== undefined;
      // Свой просмотр папки, а не результат таймера: тот мог начаться до
      // выхода ffmpeg и не увидеть последний кусок
      const { ready } = await checkDisk();

      if (ready.length > 0) {
        const batch = ready.slice(0, UPLOAD_BATCH);
        uploadedBytes += await uploadAndRemove(
          dir,
          batch,
          getTargets,
          remoteDir,
          sizes,
        );
        uploadedFiles += batch.length;
        continue;
      }
      if (finished) break;
      await Promise.race([exited, sleep(POLL_MS)]);
    }

    if (exitCode !== 0) {
      throw new Error(`ffmpeg exited with ${exitCode}: ${stderr}`);
    }
    const bandwidth = measureBandwidth(
      await readFile(join(dir, "index.m3u8"), "utf8"),
      sizes,
      { durationSeconds: source.durationSeconds, bitrate: variant.bitrate },
    );
    uploadedBytes += await uploadAndRemove(
      dir,
      ["init.mp4"],
      getTargets,
      remoteDir,
    );
    uploadedBytes += await uploadAndRemove(
      dir,
      ["index.m3u8"],
      getTargets,
      remoteDir,
    );
    uploadedFiles += 2;
    console.log(
      `[hls] ${variant.name} готово за ${seconds()}: ${uploadedFiles} файлов / ` +
        `${mb(uploadedBytes)}, ${(bandwidth.average / 1e6).toFixed(1)} Мбит/с ` +
        `(пик ${(bandwidth.peak / 1e6).toFixed(1)}), пик на диске ${mb(peakBytes)}`,
    );
    return { files: uploadedFiles, bandwidth };
  } finally {
    clearInterval(watcher);
    clearInterval(progressLog);
    signal?.removeEventListener("abort", stop);
    stop();
    await exited;
    await watching;
  }
}

/**
 * Режет видео в несколько качеств (planVariants) и заливает: каждое в свою
 * папку, по очереди — одновременно ffmpeg занял бы весь процессор и диск
 * пода. Последним заливается master.m3u8: по нему сайт понимает, что всё на
 * месте. Возвращает число залитых файлов.
 */
export async function segmentAndUpload(
  sourceUrl: string,
  source: ProbeResult,
  dir: string,
  getTargets: (files: string[]) => Promise<UploadTargets>,
  options: SegmentOptions = {},
): Promise<number> {
  const variants = planVariants(source);
  console.log(
    `[hls] качества: ${variants
      .map(
        (v) => `${v.name} ${v.height ? `${v.width}x${v.height}` : "исходник"}`,
      )
      .join(", ")}`,
  );
  let files = 0;
  const bandwidth: VariantBandwidth[] = [];
  for (const variant of variants) {
    options.signal?.throwIfAborted();
    const variantDir = join(dir, variant.name);
    await mkdir(variantDir);
    const result = await cutVariant(
      sourceUrl,
      source,
      variant,
      variantDir,
      getTargets,
      options,
    );
    await rm(variantDir, { recursive: true, force: true });
    files += result.files;
    bandwidth.push(result.bandwidth);
  }
  await writeFile(
    join(dir, "master.m3u8"),
    masterPlaylist(variants, bandwidth),
  );
  await uploadAndRemove(dir, ["master.m3u8"], getTargets);
  return files + 1;
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
