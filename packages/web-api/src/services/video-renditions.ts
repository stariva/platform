import { randomUUID } from "node:crypto";
import { logger } from "@stariva/config";
import {
  and,
  db,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "@stariva/db";
import { videoRenditions, workshops } from "@stariva/db/schema";
import {
  hlsPlaylistFile,
  objectExists,
  workshopHlsPrefix,
} from "@stariva/storage";

/** Сколько раз воркер пробует нарезать видео, прежде чем сдаться. */
export const MAX_RENDITION_ATTEMPTS = 3;
// Столько видео считается занятым воркером без вестей от него. Живой воркер
// продлевает аренду каждые несколько минут, а упавший (под убили, кончилась
// память) освобождает видео для повтора уже через 20 минут
export const PROCESSING_LEASE_MS = 20 * 60_000;
// Пауза перед новой попыткой после ошибки
const RETRY_BACKOFF_MS = 30 * 60_000;

/** Нарезка, которую видят зрители: папка в бакете и плейлист в ней. */
export interface ReadyRendition {
  hlsPrefix: string;
  /** index.m3u8 (одно качество) или master.m3u8 (несколько). */
  playlist: string;
}

/**
 * Готовая HLS-версия видео или null. Пока видео перерезают в новую версию,
 * это прежняя нарезка. Пока колонок нет (миграция не применена) или база
 * недоступна — null: плеер покажет исходный MP4.
 */
export async function getReadyRendition(
  videoKey: string,
): Promise<ReadyRendition | null> {
  try {
    const [row] = await db
      .select()
      .from(videoRenditions)
      .where(eq(videoRenditions.videoKey, videoKey))
      .limit(1);
    if (row?.readyHlsPrefix) {
      return {
        hlsPrefix: row.readyHlsPrefix,
        playlist: hlsPlaylistFile(row.readyVersion ?? 1),
      };
    }
    // Готово, но без ready_*: дорезал воркер, ещё не знающий о версиях
    if (row?.status === "ready") {
      return {
        hlsPrefix: row.hlsPrefix,
        playlist: hlsPlaylistFile(row.version),
      };
    }
    return null;
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

/** Причина отказа, когда воркер пропал на последней попытке. */
export const WORKER_LOST_ERROR =
  "worker_lost: аренда истекла без продления и без отчёта воркера";

/**
 * Последняя попытка, чей воркер пропал (под убили, кончилась память):
 * аренда истекла, а ни `complete`, ни `fail` не пришло. Повторять уже
 * нечем, поэтому помечаем видео упавшим. Иначе оно навсегда оставалось бы
 * «в работе» с пустой причиной. Попытки, у которых остались повторы, не
 * трогаем: их сразу заберёт следующий воркер.
 */
async function failExhaustedAbandonedAttempts(now: Date): Promise<void> {
  await db
    .update(videoRenditions)
    .set({ status: "failed", error: WORKER_LOST_ERROR, updatedAt: now })
    .where(
      and(
        eq(videoRenditions.status, "processing"),
        gte(videoRenditions.attempts, MAX_RENDITION_ATTEMPTS),
        lt(videoRenditions.leaseUntil, now),
      ),
    );
}

/**
 * Берёт в работу следующее видео без HLS-версии, а когда таких нет — готовое,
 * но нарезанное в версию младше той, что умеет воркер (`version`). Занятое
 * видео другой воркер не получит, пока не истечёт аренда. null — нарезать
 * нечего.
 *
 * Перерезка начинает счёт попыток заново, а зрители до её конца смотрят
 * прежнюю нарезку (ready_hls_prefix). Если перерезать не вышло, прежняя так
 * и остаётся.
 */
export async function claimNextVideo(version = 1): Promise<{
  videoKey: string;
  hlsPrefix: string;
  attemptId: number;
} | null> {
  await failExhaustedAbandonedAttempts(new Date());

  const keys = await allLessonVideoKeys();
  if (keys.length === 0) return null;

  const existing = await db
    .select()
    .from(videoRenditions)
    .where(inArray(videoRenditions.videoKey, keys));
  const byKey = new Map(existing.map((row) => [row.videoKey, row]));
  const now = new Date();
  const isUpgrade = (videoKey: string) => {
    const row = byKey.get(videoKey);
    return row?.status === "ready" && row.version < version;
  };
  // Сначала видео без нарезки: перерезка готовых подождёт
  const queue = [
    ...keys.filter((key) => !isUpgrade(key)),
    ...keys.filter(isUpgrade),
  ];

  for (const videoKey of queue) {
    const row = byKey.get(videoKey);
    if (
      row &&
      !isUpgrade(videoKey) &&
      (row.status === "ready" ||
        row.attempts >= MAX_RENDITION_ATTEMPTS ||
        (row.leaseUntil && row.leaseUntil > now))
    ) {
      continue;
    }

    const hlsPrefix = `${workshopHlsPrefix(videoKey)}/${randomUUID()}`;
    const leaseUntil = new Date(now.getTime() + PROCESSING_LEASE_MS);
    // Условный upsert: если видео успел забрать другой воркер, строки не будет
    const wasReady = sql`${videoRenditions.status} = 'ready'`;
    const [claimed] = await db
      .insert(videoRenditions)
      .values({
        videoKey,
        status: "processing",
        hlsPrefix,
        version,
        attempts: 1,
        leaseUntil,
      })
      .onConflictDoUpdate({
        target: videoRenditions.videoKey,
        set: {
          status: "processing",
          hlsPrefix,
          version,
          // Перерезка готового видео — новый счёт попыток
          attempts: sql`case when ${wasReady} then 1 else ${videoRenditions.attempts} + 1 end`,
          // Готовая нарезка без ready_* (её закончил воркер до версий):
          // запоминаем, чтобы зрители смотрели её, пока идёт перерезка
          readyHlsPrefix: sql`coalesce(${videoRenditions.readyHlsPrefix}, case when ${wasReady} then ${videoRenditions.hlsPrefix} end)`,
          readyVersion: sql`coalesce(${videoRenditions.readyVersion}, case when ${wasReady} then ${videoRenditions.version} end)`,
          leaseUntil,
          error: null,
          updatedAt: now,
        },
        setWhere: or(
          and(
            ne(videoRenditions.status, "ready"),
            lt(videoRenditions.attempts, MAX_RENDITION_ATTEMPTS),
            or(
              isNull(videoRenditions.leaseUntil),
              lt(videoRenditions.leaseUntil, now),
            ),
          ),
          and(
            eq(videoRenditions.status, "ready"),
            lt(videoRenditions.version, version),
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
 * Попытка нарезки: видео и номер попытки. Номер — значение счётчика
 * `attempts` на момент выдачи видео воркеру.
 */
export interface RenditionAttempt {
  videoKey: string;
  attemptId: number;
}

/**
 * Попытка всё ещё текущая: номер не сменился (видео не отдано другому
 * воркеру) и нарезка не завершена. Все записи воркера идут под этим
 * условием, чтобы опоздавший воркер ничего не перетёр.
 */
function isCurrentAttempt({ videoKey, attemptId }: RenditionAttempt) {
  return and(
    eq(videoRenditions.videoKey, videoKey),
    eq(videoRenditions.attempts, attemptId),
    eq(videoRenditions.status, "processing"),
  );
}

/**
 * Папка, куда текущая попытка кладёт куски HLS-версии. null — попытка уже
 * не текущая. У каждой попытки своя папка, так что старый воркер не
 * перезапишет файлы нового.
 */
export async function getAttemptHlsPrefix(
  attempt: RenditionAttempt,
): Promise<string | null> {
  return (await getAttempt(attempt))?.hlsPrefix ?? null;
}

/** Папка и версия нарезки текущей попытки; null — попытка уже не текущая. */
async function getAttempt(attempt: RenditionAttempt) {
  const [rendition] = await db
    .select({
      hlsPrefix: videoRenditions.hlsPrefix,
      version: videoRenditions.version,
    })
    .from(videoRenditions)
    .where(isCurrentAttempt(attempt))
    .limit(1);
  return rendition ?? null;
}

/**
 * Воркер жив и всё ещё режет эту попытку — продлеваем аренду. false —
 * попытка уже не его (истекла и отдана другому, или видео готово): воркеру
 * пора бросить работу.
 */
export async function extendRenditionLease(
  attempt: RenditionAttempt,
): Promise<boolean> {
  const now = new Date();
  const [row] = await db
    .update(videoRenditions)
    .set({
      leaseUntil: new Date(now.getTime() + PROCESSING_LEASE_MS),
      updatedAt: now,
    })
    .where(isCurrentAttempt(attempt))
    .returning({ videoKey: videoRenditions.videoKey });
  return Boolean(row);
}

/**
 * Воркер залил все куски. Отмечаем готовым, только если плейлист правда
 * лежит в бакете: он заливается последним (у версии 2 — master.m3u8). С
 * этого момента зрители смотрят новую нарезку.
 */
export async function completeRendition(
  attempt: RenditionAttempt,
  durationSeconds: number,
): Promise<"ready" | "not_found" | "missing_playlist"> {
  const current = await getAttempt(attempt);
  if (!current) return "not_found";
  const { hlsPrefix, version } = current;
  if (!(await objectExists(`${hlsPrefix}/${hlsPlaylistFile(version)}`))) {
    return "missing_playlist";
  }
  const [row] = await db
    .update(videoRenditions)
    .set({
      status: "ready",
      hlsPrefix,
      readyHlsPrefix: hlsPrefix,
      readyVersion: version,
      durationSeconds: Math.round(durationSeconds),
      leaseUntil: null,
      error: null,
      updatedAt: new Date(),
    })
    // Аренда могла истечь, пока проверяли бакет: условие повторяем
    .where(isCurrentAttempt(attempt))
    .returning({ videoKey: videoRenditions.videoKey });
  return row ? "ready" : "not_found";
}

/** Нарезка упала: повторим позже, пока не кончатся попытки. */
export async function failRendition(
  attempt: RenditionAttempt,
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
    .where(isCurrentAttempt(attempt));
}
