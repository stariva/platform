import { randomUUID } from "node:crypto";
import { db } from "@stariva/db";
import { videoAccessLog } from "@stariva/db/schema";
import { and, count, eq, gt, isNull, lt } from "drizzle-orm";

/**
 * Сколько ссылок на видео можно получить за окно. Обычный просмотр — одна
 * ссылка на урок и новая раз в 15 минут, так что предел с большим запасом;
 * упираются в него только скрипты, которые выкачивают курс.
 */
export const VIDEO_SIGN_WINDOW_MINUTES = 10;
export const VIDEO_SIGN_MAX_PER_WINDOW = 60;

// Доля запросов, после которых чистим старые записи журнала
const CLEANUP_CHANCE = 0.01;

interface VideoAccess {
  userId: string | null;
  workshopSlug: string;
  lessonId: string;
  ip: string | null;
  userAgent: string | null;
}

/**
 * Превышен ли предел ссылок: для вошедших считаем по аккаунту, для превью без
 * входа — по IP. Если журнал недоступен, видео не блокируем.
 */
export async function isVideoSignRateLimited(
  access: Pick<VideoAccess, "userId" | "ip">,
): Promise<boolean> {
  const who = access.userId
    ? eq(videoAccessLog.userId, access.userId)
    : access.ip
      ? and(isNull(videoAccessLog.userId), eq(videoAccessLog.ip, access.ip))
      : null;
  if (!who) return false;

  const since = new Date(Date.now() - VIDEO_SIGN_WINDOW_MINUTES * 60_000);
  try {
    const [row] = await db
      .select({ n: count() })
      .from(videoAccessLog)
      .where(and(who, gt(videoAccessLog.createdAt, since)));
    return (row?.n ?? 0) >= VIDEO_SIGN_MAX_PER_WINDOW;
  } catch (error) {
    console.error("[video-access] Не удалось проверить предел:", error);
    return false;
  }
}

/**
 * Записывает выдачу ссылки. Сбой журнала не мешает смотреть урок.
 * Изредка заодно удаляет записи старше года — так обещает Политика.
 */
export async function logVideoAccess(access: VideoAccess): Promise<void> {
  try {
    await db.insert(videoAccessLog).values({
      id: randomUUID(),
      ...access,
      userAgent: access.userAgent?.slice(0, 500) ?? null,
    });
    if (Math.random() < CLEANUP_CHANCE) {
      const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60_000);
      await db
        .delete(videoAccessLog)
        .where(lt(videoAccessLog.createdAt, yearAgo));
    }
  } catch (error) {
    console.error("[video-access] Не удалось записать в журнал:", error);
  }
}
