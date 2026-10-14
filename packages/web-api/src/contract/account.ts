import { error, oc, type } from "@orpc/contract";
import { z } from "zod";

/**
 * Кабинет покупателя: процедуры вызывает браузер, доступ — по cookie
 * сессии. Без входа: доступ к курсу — «не вошёл», прогресс — UNAUTHORIZED.
 */

/** Такого урока нет в мастер-классе (или мастер-класс снят). */
export const LessonNotFoundError = error("LESSON_NOT_FOUND", {
  message: "Урок не найден",
});

const workshopSlug = z.string().min(1).max(200);

export const accountContract = {
  /** Вошёл ли посетитель и купил ли он мастер-класс. */
  workshopAccess: oc
    .input(z.object({ slug: workshopSlug }))
    .output(z.object({ authenticated: z.boolean(), owned: z.boolean() })),

  /**
   * Сохраняет место, где покупатель остановился в уроке. Только владельцам
   * курса: остальным — FORBIDDEN.
   */
  saveLessonProgress: oc
    .errors({ [LessonNotFoundError.code]: LessonNotFoundError })
    .input(
      z.object({
        slug: workshopSlug,
        lessonId: z.string().min(1).max(200),
        positionSeconds: z.number().min(0),
        durationSeconds: z.number().min(0),
        completed: z.boolean().optional(),
      }),
    )
    .output(type<void>()),
};
