import { and, eq, videoAccessLog } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { viewDay, viewerKey } from "./views";

/**
 * Удаляет просмотры из журнала выдачи ссылок на видео — например, свои
 * проверочные. С `lesson` — одну строку таблицы просмотров (урок за день),
 * без него — все просмотры этого зрителя по всем курсам. Прогресс в плеере
 * (lesson_progress) не трогает: «продолжить с места» у человека останется.
 *
 * @example client.admin.workshops.removeViews({ viewer: "usr_1", lesson: { workshopSlug: "elka-makrame", lessonId: "l-1", day: "2026-10-20" } })
 */
export const removeViews = adminProcedure
  .input(
    z.object({
      // Ключ зрителя из admin.workshops.views: id аккаунта или «ip:…» для гостя
      viewer: z.string().min(1).max(200),
      lesson: z
        .object({
          workshopSlug: z.string().min(1).max(200),
          lessonId: z.string().min(1).max(200),
          day: z.iso.date(),
        })
        .optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    const deleted = await context.db
      .delete(videoAccessLog)
      .where(
        and(
          eq(viewerKey, input.viewer),
          input.lesson
            ? and(
                eq(videoAccessLog.workshopSlug, input.lesson.workshopSlug),
                eq(videoAccessLog.lessonId, input.lesson.lessonId),
                eq(viewDay, input.lesson.day),
              )
            : undefined,
        ),
      )
      .returning({ id: videoAccessLog.id });
    return { deleted: deleted.length };
  });
