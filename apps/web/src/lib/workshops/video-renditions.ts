import { randomUUID } from "node:crypto";
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
// Столько видео считается занятым воркером без вестей от него. Живой воркер
// продлевает аренду каждые несколько минут, а упавший (под убили, кончилась
// память) освобождает видео для повтора уже через 20 минут
export const PROCESSING_LEASE_MS = 20 * 60_000;
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
  attemptId: number;
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

    const hlsPrefix = `${workshopHlsPrefix(videoKey)}/${randomUUID()}`;
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
          hlsPrefix,
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
      // Счётчик увеличивается атомарно и служит идентификатором попытки.
      .returning({
        videoKey: videoRenditions.videoKey,
        hlsPrefix: videoRenditions.hlsPrefix,
        attemptId: videoRenditions.attempts,
      });
    if (claimed) return claimed;
  }
  return null;
}

/**
 * Воркер жив и всё ещё режет эту попытку — продлеваем аренду. false —
 * попытка уже не его (истекла и отдана другому, или видео готово): воркеру
 * пора бросить работу.
 */
export async function extendRenditionLease(
  videoKey: string,
  attemptId: number,
): Promise<boolean> {
  const now = new Date();
  const [row] = await db
    .update(videoRenditions)
    .set({
      leaseUntil: new Date(now.getTime() + PROCESSING_LEASE_MS),
      updatedAt: now,
    })
    .where(
      and(
        eq(videoRenditions.videoKey, videoKey),
        eq(videoRenditions.attempts, attemptId),
        eq(videoRenditions.status, "processing"),
      ),
    )
    .returning({ videoKey: videoRenditions.videoKey });
  return Boolean(row);
}

/**
 * Воркер залил все куски. Отмечаем готовым, только если плейлист правда
 * лежит в бакете: он заливается последним.
 */
export async function completeRendition(
  videoKey: string,
  attemptId: number,
  durationSeconds: number,
): Promise<"ready" | "not_found" | "missing_playlist"> {
  const currentAttempt = and(
    eq(videoRenditions.videoKey, videoKey),
    eq(videoRenditions.attempts, attemptId),
    eq(videoRenditions.status, "processing"),
  );
  const [rendition] = await db
    .select({ hlsPrefix: videoRenditions.hlsPrefix })
    .from(videoRenditions)
    .where(currentAttempt)
    .limit(1);
  if (!rendition) return "not_found";
  const { hlsPrefix } = rendition;
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
    .where(currentAttempt)
    .returning({ videoKey: videoRenditions.videoKey });
  return row ? "ready" : "not_found";
}

/** Нарезка упала: повторим позже, пока не кончатся попытки. */
export async function failRendition(
  videoKey: string,
  attemptId: number,
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
        eq(videoRenditions.attempts, attemptId),
        eq(videoRenditions.status, "processing"),
      ),
    );
}
