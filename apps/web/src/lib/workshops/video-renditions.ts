import { logger } from "@stariva/config";
import { and, db, eq, inArray, isNull, lt, ne, or, sql } from "@stariva/db";
import {
  type VideoRenditionRow,
  videoRenditions,
  workshops,
} from "@stariva/db/schema";
import { objectExists, workshopHlsPrefix } from "@stariva/storage";

/** Сколько раз воркер пробует нарезать видео, прежде чем сдаться. */
export const MAX_RENDITION_ATTEMPTS = 3;
// Столько видео считается занятым воркером: хватает на 4 ГБ с перекодированием
const PROCESSING_LEASE_MS = 4 * 60 * 60_000;
// Пауза перед новой попыткой после ошибки
const RETRY_BACKOFF_MS = 30 * 60_000;

/**
 * Готовая HLS-версия видео или null. Пока таблицы нет (миграция не
 * применена) или база недоступна — null: плеер покажет исходный MP4.
 */
export async function getReadyRendition(
  videoKey: string,
): Promise<VideoRenditionRow | null> {
  try {
    const [row] = await db
      .select()
      .from(videoRenditions)
      .where(
        and(
          eq(videoRenditions.videoKey, videoKey),
          eq(videoRenditions.status, "ready"),
        ),
      )
      .limit(1);
    return row ?? null;
  } catch (error) {
    logger.warn("video.rendition.unavailable", { error: String(error) });
    return null;
  }
}

/** Все загруженные видео уроков, включая черновики: их тоже смотрят в админке. */
async function allLessonVideoKeys(): Promise<string[]> {
  const rows = await db.select({ lessons: workshops.lessons }).from(workshops);
  const keys = rows.flatMap((row) =>
    row.lessons.map((lesson) => lesson.videoKey).filter(Boolean),
  );
  return [...new Set(keys)];
}

/**
 * Берёт в работу следующее видео без HLS-версии. Занятое видео другой
 * воркер не получит, пока не истечёт аренда. null — нарезать нечего.
 */
export async function claimNextVideo(): Promise<{
  videoKey: string;
  hlsPrefix: string;
} | null> {
  const keys = await allLessonVideoKeys();
  if (keys.length === 0) return null;

  const existing = await db
    .select()
    .from(videoRenditions)
    .where(inArray(videoRenditions.videoKey, keys));
  const byKey = new Map(existing.map((row) => [row.videoKey, row]));
  const now = new Date();

  for (const videoKey of keys) {
    const row = byKey.get(videoKey);
    if (
      row &&
      (row.status === "ready" ||
        row.attempts >= MAX_RENDITION_ATTEMPTS ||
        (row.leaseUntil && row.leaseUntil > now))
    ) {
      continue;
    }

    const hlsPrefix = workshopHlsPrefix(videoKey);
    const leaseUntil = new Date(now.getTime() + PROCESSING_LEASE_MS);
    // Условный upsert: если видео успел забрать другой воркер, строки не будет
    const [claimed] = await db
      .insert(videoRenditions)
      .values({
        videoKey,
        status: "processing",
        hlsPrefix,
        attempts: 1,
        leaseUntil,
      })
      .onConflictDoUpdate({
        target: videoRenditions.videoKey,
        set: {
          status: "processing",
          attempts: sql`${videoRenditions.attempts} + 1`,
          leaseUntil,
          error: null,
          updatedAt: now,
        },
        setWhere: and(
          ne(videoRenditions.status, "ready"),
          lt(videoRenditions.attempts, MAX_RENDITION_ATTEMPTS),
          or(
            isNull(videoRenditions.leaseUntil),
            lt(videoRenditions.leaseUntil, now),
          ),
        ),
      })
      .returning({ videoKey: videoRenditions.videoKey });
    if (claimed) return { videoKey, hlsPrefix };
  }
  return null;
}

/**
 * Воркер залил все куски. Отмечаем готовым, только если плейлист правда
 * лежит в бакете: он заливается последним.
 */
export async function completeRendition(
  videoKey: string,
  durationSeconds: number,
): Promise<"ready" | "not_found" | "missing_playlist"> {
  const hlsPrefix = workshopHlsPrefix(videoKey);
  if (!(await objectExists(`${hlsPrefix}/index.m3u8`))) {
    return "missing_playlist";
  }
  const [row] = await db
    .update(videoRenditions)
    .set({
      status: "ready",
      hlsPrefix,
      durationSeconds: Math.round(durationSeconds),
      leaseUntil: null,
      error: null,
      updatedAt: new Date(),
    })
    .where(eq(videoRenditions.videoKey, videoKey))
    .returning({ videoKey: videoRenditions.videoKey });
  return row ? "ready" : "not_found";
}

/** Нарезка упала: повторим позже, пока не кончатся попытки. */
export async function failRendition(
  videoKey: string,
  error: string,
): Promise<void> {
  const now = new Date();
  await db
    .update(videoRenditions)
    .set({
      status: "failed",
      error: error.slice(0, 2000),
      leaseUntil: new Date(now.getTime() + RETRY_BACKOFF_MS),
      updatedAt: now,
    })
    .where(
      and(
        eq(videoRenditions.videoKey, videoKey),
        ne(videoRenditions.status, "ready"),
      ),
    );
}
