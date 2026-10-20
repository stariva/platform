import {
  and,
  count,
  desc,
  eq,
  ilike,
  lessonProgress,
  or,
  sql,
  user,
  videoAccessLog,
  workshops,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

/** Экранирует % и _ в поисковой строке, чтобы они искались как обычные символы. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// День просмотра по Москве: ссылка на видео обновляется раз в 15 минут,
// так что записи журнала за день по одному уроку — один заход
const day = sql<string>`((${videoAccessLog.createdAt} at time zone 'Europe/Moscow')::date)::text`;
// Гость без входа (бесплатный урок) различается только по IP
const viewer = sql<string>`coalesce(${videoAccessLog.userId}, 'ip:' || coalesce(${videoAccessLog.ip}, ''))`;

/**
 * Просмотры уроков мастер-классов, свежие сверху. Строка — один зритель,
 * один урок, один день (по Москве): когда начал и закончил, с каких адресов
 * и устройства, сколько раз брал ссылку на видео. Источник — журнал выдачи
 * ссылок (video_access_log, хранится год), прогресс — из lesson_progress.
 *
 * Вместе со страницей отдаёт курсы, которые смотрели (для фильтра).
 *
 * @example client.admin.workshops.views({ workshop: "elka-makrame", limit: 50, offset: 0 })
 */
export const viewsList = adminProcedure
  .input(
    z.object({
      workshop: z.string().trim().min(1).max(200).optional(),
      query: z.string().trim().max(100).optional(),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ context, input }) => {
    const pattern = input.query ? `%${escapeLike(input.query)}%` : null;
    const where = and(
      input.workshop
        ? eq(videoAccessLog.workshopSlug, input.workshop)
        : undefined,
      pattern
        ? or(
            ilike(user.name, pattern),
            ilike(user.email, pattern),
            ilike(videoAccessLog.ip, pattern),
          )
        : undefined,
    );

    const sessions = context.db
      .select({
        viewer: sql<string>`${viewer}`.as("view_viewer"),
        userId: sql<string | null>`max(${videoAccessLog.userId})`.as(
          "view_user_id",
        ),
        workshopSlug: videoAccessLog.workshopSlug,
        lessonId: videoAccessLog.lessonId,
        day: sql<string>`${day}`.as("view_day"),
        firstAt: sql<Date>`min(${videoAccessLog.createdAt})`
          .mapWith(videoAccessLog.createdAt)
          .as("view_first_at"),
        lastAt: sql<Date>`max(${videoAccessLog.createdAt})`
          .mapWith(videoAccessLog.createdAt)
          .as("view_last_at"),
        hits: sql<number>`count(*)::int`.as("view_hits"),
        ips: sql<string[]>`array_remove(array_agg(distinct ${videoAccessLog.ip}), null)`.as(
          "view_ips",
        ),
        userAgent:
          sql<string | null>`(array_agg(${videoAccessLog.userAgent} order by ${videoAccessLog.createdAt} desc))[1]`.as(
            "view_user_agent",
          ),
      })
      .from(videoAccessLog)
      .leftJoin(user, eq(user.id, videoAccessLog.userId))
      .where(where)
      .groupBy(viewer, videoAccessLog.workshopSlug, videoAccessLog.lessonId, day)
      .as("s");

    // Номер и название урока — из массива уроков курса
    const lesson = sql<{ title: string; position: number } | null>`(
      select jsonb_build_object('title', l.value->>'title', 'position', l.ordinality)
      from jsonb_array_elements(${workshops.lessons}) with ordinality as l(value, ordinality)
      where l.value->>'id' = ${sessions.lessonId}
    )`;

    const [rows, [totals], byWorkshop] = await Promise.all([
      context.db
        .select({
          viewer: sessions.viewer,
          userId: sessions.userId,
          userName: user.name,
          userEmail: user.email,
          workshopSlug: sessions.workshopSlug,
          workshopTitle: workshops.title,
          lessonId: sessions.lessonId,
          lessonsCount: sql<number>`jsonb_array_length(${workshops.lessons})`,
          lesson,
          day: sessions.day,
          firstAt: sessions.firstAt,
          lastAt: sessions.lastAt,
          hits: sessions.hits,
          ips: sessions.ips,
          userAgent: sessions.userAgent,
          positionSeconds: lessonProgress.positionSeconds,
          durationSeconds: lessonProgress.durationSeconds,
          completed: lessonProgress.completed,
        })
        .from(sessions)
        .leftJoin(user, eq(user.id, sessions.userId))
        .leftJoin(workshops, eq(workshops.slug, sessions.workshopSlug))
        .leftJoin(
          lessonProgress,
          and(
            eq(lessonProgress.userId, sessions.userId),
            eq(lessonProgress.lessonId, sessions.lessonId),
          ),
        )
        .orderBy(desc(sessions.lastAt))
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ total: count() }).from(sessions),
      context.db
        .select({
          slug: videoAccessLog.workshopSlug,
          title: workshops.title,
          viewers: sql<number>`count(distinct ${viewer})::int`,
          accounts: sql<number>`count(distinct ${videoAccessLog.userId})::int`,
        })
        .from(videoAccessLog)
        .leftJoin(workshops, eq(workshops.slug, videoAccessLog.workshopSlug))
        .groupBy(videoAccessLog.workshopSlug, workshops.title)
        .orderBy(videoAccessLog.workshopSlug),
    ]);

    return {
      items: rows.map(
        ({ lesson, positionSeconds, durationSeconds, completed, ...row }) => ({
          ...row,
          lessonTitle: lesson?.title ?? null,
          lessonPosition: lesson ? Number(lesson.position) : null,
          // Прогресс по уроку сейчас, а не на конец этого дня
          progress: durationSeconds
            ? {
                positionSeconds: positionSeconds ?? 0,
                durationSeconds,
                completed: completed ?? false,
              }
            : null,
        }),
      ),
      total: totals?.total ?? 0,
      workshops: byWorkshop.map((row) => ({
        slug: row.slug,
        title: row.title ?? row.slug,
        viewers: row.viewers,
        accounts: row.accounts,
      })),
    };
  });
