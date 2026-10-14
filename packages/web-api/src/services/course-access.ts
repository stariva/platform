import { randomUUID } from "node:crypto";
import { and, db, eq, ne } from "@stariva/db";
import { courseAccess, lessonProgress, workshops } from "@stariva/db/schema";

/** Проверяет, есть ли у пользователя доступ к мастер-классу. */
export async function hasAccess(
  userId: string,
  workshopSlug: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: courseAccess.id })
    .from(courseAccess)
    .where(
      and(
        eq(courseAccess.userId, userId),
        eq(courseAccess.workshopSlug, workshopSlug),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Урок есть в мастер-классе, который видят купившие: опубликованном или
 * архивном. Черновики не в счёт.
 */
export async function lessonExists(
  workshopSlug: string,
  lessonId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ lessons: workshops.lessons })
    .from(workshops)
    .where(and(eq(workshops.slug, workshopSlug), ne(workshops.status, "draft")))
    .limit(1);
  return Boolean(row?.lessons.some((lesson) => lesson.id === lessonId));
}

export interface UpsertProgressInput {
  userId: string;
  workshopSlug: string;
  lessonId: string;
  positionSeconds: number;
  durationSeconds: number;
  completed?: boolean;
}

/** Сохраняет/обновляет прогресс просмотра урока. */
export async function upsertLessonProgress(
  input: UpsertProgressInput,
): Promise<void> {
  const completed =
    input.completed ??
    (input.durationSeconds > 0 &&
      input.positionSeconds / input.durationSeconds >= 0.95);

  await db
    .insert(lessonProgress)
    .values({
      id: randomUUID(),
      userId: input.userId,
      workshopSlug: input.workshopSlug,
      lessonId: input.lessonId,
      positionSeconds: Math.max(0, Math.floor(input.positionSeconds)),
      durationSeconds: Math.max(0, Math.floor(input.durationSeconds)),
      completed,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: {
        positionSeconds: Math.max(0, Math.floor(input.positionSeconds)),
        durationSeconds: Math.max(0, Math.floor(input.durationSeconds)),
        completed,
        updatedAt: new Date(),
      },
    });
}
