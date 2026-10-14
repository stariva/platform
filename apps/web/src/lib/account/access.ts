import { randomUUID } from "node:crypto";
import { db } from "@stariva/db";
import { courseAccess, lessonProgress } from "@stariva/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getWorkshopLessons, type Workshop } from "@/lib/workshops-data";

// Доступ к курсу и прогресс уроков переехали в API витрины: их зовут и
// процедуры кабинета, и страницы. Реэкспорт — пока страницы не перешли
export {
  hasAccess,
  type UpsertProgressInput,
  upsertLessonProgress,
} from "@stariva/web-api";

/**
 * Идемпотентно выдаёт доступ к мастер-классу.
 * Повторный вызов для той же пары (пользователь, курс) ничего не меняет.
 */
export async function grantAccess(
  userId: string,
  workshopSlug: string,
  orderId?: string,
): Promise<void> {
  await db
    .insert(courseAccess)
    .values({
      id: randomUUID(),
      userId,
      workshopSlug,
      orderId: orderId ?? null,
    })
    .onConflictDoNothing({
      target: [courseAccess.userId, courseAccess.workshopSlug],
    });
}

/** Возвращает список slug мастер-классов, к которым у пользователя есть доступ. */
export async function listAccessibleSlugs(userId: string): Promise<string[]> {
  const rows = await db
    .select({ slug: courseAccess.workshopSlug })
    .from(courseAccess)
    .where(eq(courseAccess.userId, userId));
  return rows.map((r) => r.slug);
}

export interface LessonProgressRow {
  lessonId: string;
  positionSeconds: number;
  durationSeconds: number;
  completed: boolean;
}

/** Прогресс по всем урокам одного мастер-класса в виде Map(lessonId → данные). */
export async function getCourseProgressMap(
  userId: string,
  workshopSlug: string,
): Promise<Map<string, LessonProgressRow>> {
  const rows = await db
    .select({
      lessonId: lessonProgress.lessonId,
      positionSeconds: lessonProgress.positionSeconds,
      durationSeconds: lessonProgress.durationSeconds,
      completed: lessonProgress.completed,
    })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.workshopSlug, workshopSlug),
      ),
    );
  return new Map(rows.map((r) => [r.lessonId, r]));
}

export interface CourseProgressSummary {
  totalLessons: number;
  completedLessons: number;
  percent: number;
  /** Урок для кнопки «Продолжить»: первый незавершённый, иначе последний. */
  resumeLessonId: string | null;
  isComplete: boolean;
}

/** Агрегированный прогресс по мастер-классу. */
export async function getCourseProgressSummary(
  userId: string,
  workshop: Workshop,
): Promise<CourseProgressSummary> {
  const lessons = getWorkshopLessons(workshop);
  const progress = await getCourseProgressMap(userId, workshop.slug);

  const completedLessons = lessons.filter(
    (l) => progress.get(l.id)?.completed,
  ).length;
  const total = lessons.length;
  const percent =
    total === 0 ? 0 : Math.round((completedLessons / total) * 100);

  const firstUnfinished = lessons.find((l) => !progress.get(l.id)?.completed);
  const resumeLessonId =
    firstUnfinished?.id ?? lessons[lessons.length - 1]?.id ?? null;

  return {
    totalLessons: total,
    completedLessons,
    percent,
    resumeLessonId,
    isComplete: total > 0 && completedLessons === total,
  };
}

/** Прогресс по нескольким курсам сразу (для списка «Мои мастер-классы»). */
export async function getProgressForSlugs(
  userId: string,
  slugs: string[],
): Promise<Map<string, LessonProgressRow[]>> {
  if (slugs.length === 0) return new Map();
  const rows = await db
    .select({
      workshopSlug: lessonProgress.workshopSlug,
      lessonId: lessonProgress.lessonId,
      positionSeconds: lessonProgress.positionSeconds,
      durationSeconds: lessonProgress.durationSeconds,
      completed: lessonProgress.completed,
    })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        inArray(lessonProgress.workshopSlug, slugs),
      ),
    );

  const map = new Map<string, LessonProgressRow[]>();
  for (const r of rows) {
    const list = map.get(r.workshopSlug) ?? [];
    list.push(r);
    map.set(r.workshopSlug, list);
  }
  return map;
}
