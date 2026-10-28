import { type Database, inArray, videoRenditions } from "@stariva/db";
import {
  getObjectBytes,
  getObjectText,
  HLS_SEGMENT_SECONDS,
  type HlsVariantInfo,
  isStorageConfigured,
  listObjects,
  mp4FrameSize,
  objectLastModified,
  parseMasterPlaylist,
  plannedHlsSizes,
} from "@stariva/storage";
import { MAX_RENDITION_ATTEMPTS } from "@stariva/web-api";

/** Одно качество в текущей попытке нарезки. */
export interface HlsAttemptVariant {
  /** Короткая сторона кадра, px; null — пока неизвестна. */
  size: number | null;
  /** done — залито целиком, cutting — режется, waiting — ждёт своей очереди. */
  state: "done" | "cutting" | "waiting";
  /** Сколько кусков уже в бакете. */
  segments: number;
}

/** Как идёт текущая попытка: качества режутся по очереди, от лучшего. */
export interface HlsAttemptProgress {
  variants: HlsAttemptVariant[];
  /** Сколько кусков будет в каждом качестве; null — неизвестно. */
  totalSegments: number | null;
}

/** Что с видео урока: когда загрузили и как идёт нарезка в HLS. */
export interface LessonVideoInfo {
  /** Время из бакета; null — файла нет или хранилище не ответило. */
  uploadedAt: Date | null;
  hls: {
    /**
     * queued — воркер ещё не брался, processing — режет, ready — нарезка
     * готова, failed — не вышло (willRetry: попробует ещё).
     */
    state: "queued" | "processing" | "ready" | "failed";
    attempts: number;
    willRetry: boolean;
    error: string | null;
    /**
     * Когда нарезка последний раз менялась: старт попытки, отметка «жив» от
     * воркера, готово, ошибка.
     */
    updatedAt: Date | null;
    /**
     * В работе, но воркер пропал: аренда истекла без продления и без отчёта.
     * Пока есть попытки, видео заберёт следующий запуск нарезки.
     */
    stalled: boolean;
    /** Ход текущей попытки по качествам; только пока режется. */
    progress: HlsAttemptProgress | null;
    /**
     * Нарезка, которую видят зрители. Бывает и при processing: пока видео
     * перерезают в новую версию, показывают прежнюю.
     */
    ready: {
      version: number;
      /** От лучшего к худшему. У версии 1 пусто: качество одно, без списка. */
      variants: HlsVariantInfo[];
    } | null;
  };
}

/** Качества готовой нарезки. Не прочитали плейлист — пусто, без ошибки. */
async function readyVariants(
  hlsPrefix: string,
  version: number,
): Promise<HlsVariantInfo[]> {
  if (version < 2 || !isStorageConfigured()) return [];
  return getObjectText(`${hlsPrefix}/master.m3u8`)
    .then(parseMasterPlaylist)
    .catch(() => []);
}

/**
 * Ход попытки по файлам в её папке: в каждом качестве (v0, v1…) куски и,
 * когда оно залито целиком, index.m3u8. Размер верхнего качества — из его
 * init.mp4 (заливается в конце), по нему понятно, какие пойдут ниже. Сколько
 * всего кусков — по готовому качеству, а пока его нет — по длине урока.
 * Не прочитали бакет — null, без ошибки.
 */
async function attemptProgress(
  hlsPrefix: string,
  durationSeconds: number,
): Promise<HlsAttemptProgress | null> {
  if (!isStorageConfigured()) return null;
  const objects = await listObjects(`${hlsPrefix}/`).catch(() => null);
  if (!objects) return null;

  const folders = new Map<number, { segments: number; done: boolean }>();
  for (const { key } of objects) {
    const match = /\/v(\d+)\/(index\.m3u8|seg-\d{5}\.m4s)$/.exec(key);
    if (!match) continue;
    const index = Number(match[1]);
    const folder = folders.get(index) ?? { segments: 0, done: false };
    if (match[2] === "index.m3u8") folder.done = true;
    else folder.segments += 1;
    folders.set(index, folder);
  }

  const top = folders.get(0)?.done
    ? await getObjectBytes(`${hlsPrefix}/v0/init.mp4`)
        .then(mp4FrameSize)
        .catch(() => null)
    : null;
  const planned = top ? plannedHlsSizes(Math.min(top.width, top.height)) : [];
  const count = Math.max(
    planned.length,
    ...[...folders.keys()].map((i) => i + 1),
  );
  const finished = [...folders.values()].find((folder) => folder.done);
  return {
    variants: Array.from({ length: count }, (_, i): HlsAttemptVariant => {
      const folder = folders.get(i);
      return {
        size: planned[i] ?? null,
        state: folder?.done ? "done" : folder ? "cutting" : "waiting",
        segments: folder?.segments ?? 0,
      };
    }),
    totalSegments:
      finished?.segments ??
      (durationSeconds > 0
        ? Math.ceil(durationSeconds / HLS_SEGMENT_SECONDS)
        : null),
  };
}

/**
 * Видео уроков: время загрузки из бакета и состояние HLS из
 * video_renditions, а пока видео режется — и ход нарезки. Что не удалось
 * проверить, остаётся без данных — форма от этого не ломается.
 */
export async function loadLessonVideos(
  db: Database,
  lessons: { videoKey: string; durationSeconds: number }[],
): Promise<Record<string, LessonVideoInfo>> {
  const durations = new Map(
    lessons.map((lesson) => [lesson.videoKey, lesson.durationSeconds]),
  );
  const keys = [...durations.keys()].filter(Boolean);
  if (keys.length === 0) return {};
  const now = new Date();

  const rows = await db
    .select()
    .from(videoRenditions)
    .where(inArray(videoRenditions.videoKey, keys));
  const byKey = new Map(rows.map((row) => [row.videoKey, row]));

  const entries = await Promise.all(
    keys.map(async (key): Promise<[string, LessonVideoInfo]> => {
      const row = byKey.get(key);
      // Как в getReadyRendition: дорезанное воркером до версий — без ready_*
      const ready = row?.readyHlsPrefix
        ? { prefix: row.readyHlsPrefix, version: row.readyVersion ?? 1 }
        : row?.status === "ready"
          ? { prefix: row.hlsPrefix, version: row.version }
          : null;
      const processing = row?.status === "processing";
      const [uploadedAt, variants, progress] = await Promise.all([
        isStorageConfigured()
          ? objectLastModified(key).catch(() => null)
          : null,
        ready ? readyVariants(ready.prefix, ready.version) : [],
        processing
          ? attemptProgress(row.hlsPrefix, durations.get(key) ?? 0)
          : null,
      ]);
      return [
        key,
        {
          uploadedAt,
          hls: {
            state: row?.status ?? "queued",
            attempts: row?.attempts ?? 0,
            willRetry: (row?.attempts ?? 0) < MAX_RENDITION_ATTEMPTS,
            error: row?.error ?? null,
            updatedAt: row?.updatedAt ?? null,
            stalled: Boolean(
              processing && row.leaseUntil && row.leaseUntil < now,
            ),
            progress,
            ready: ready ? { version: ready.version, variants } : null,
          },
        },
      ];
    }),
  );
  return Object.fromEntries(entries);
}
