import { type Database, inArray, videoRenditions } from "@stariva/db";
import {
  getObjectText,
  type HlsVariantInfo,
  isStorageConfigured,
  objectLastModified,
  parseMasterPlaylist,
} from "@stariva/storage";
import { MAX_RENDITION_ATTEMPTS } from "@stariva/web-api";

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
    /** Когда нарезка последний раз менялась: старт попытки, готово, ошибка. */
    updatedAt: Date | null;
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
 * Видео уроков по ключам: время загрузки из бакета и состояние HLS из
 * video_renditions. Что не удалось проверить, остаётся без данных — форма
 * от этого не ломается.
 */
export async function loadLessonVideos(
  db: Database,
  videoKeys: string[],
): Promise<Record<string, LessonVideoInfo>> {
  const keys = [...new Set(videoKeys.filter(Boolean))];
  if (keys.length === 0) return {};

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
      const [uploadedAt, variants] = await Promise.all([
        isStorageConfigured()
          ? objectLastModified(key).catch(() => null)
          : null,
        ready ? readyVariants(ready.prefix, ready.version) : [],
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
            ready: ready ? { version: ready.version, variants } : null,
          },
        },
      ];
    }),
  );
  return Object.fromEntries(entries);
}
