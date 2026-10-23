import { ORPCError } from "@orpc/server";
import { eq, workshops } from "@stariva/db";
import { isWorkshopKey } from "@stariva/storage";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { revalidateStorefront } from "../../../storefront";
import { storefrontPaths } from "./mapping";

/**
 * Ставит загруженное видео в уже сохранённый урок сразу, без кнопки
 * «Сохранить»: остальные правки формы остаются несохранёнными. Урока, которого
 * в курсе ещё нет, не трогаем — `saved: false`, видео попадёт в курс с формой.
 *
 * @example client.admin.workshops.setLessonVideo({ id: "ws_1", lessonId: "l-1", videoKey, durationSeconds: 754 })
 */
export const setLessonVideo = adminProcedure
  .input(
    z.object({
      id: z.string().min(1),
      lessonId: z.string().min(1).max(100),
      videoKey: z.string().trim().min(1).max(500),
      durationSeconds: z
        .number()
        .int()
        .min(0)
        .max(24 * 3600)
        .nullable(),
    }),
  )
  .handler(async ({ context, input }) => {
    // Под блокировкой: два видео, загруженные одновременно, не затрут друг друга
    const slug = await context.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ slug: workshops.slug, lessons: workshops.lessons })
        .from(workshops)
        .where(eq(workshops.id, input.id))
        .for("update");
      if (!row) {
        throw new ORPCError("NOT_FOUND", { message: "Мастер-класс не найден" });
      }
      // Как и в save: ключ только из папки этого курса
      if (!isWorkshopKey(row.slug, input.videoKey)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Файл не из папки этого мастер-класса",
        });
      }
      if (!row.lessons.some((lesson) => lesson.id === input.lessonId)) {
        return null;
      }

      await tx
        .update(workshops)
        .set({
          lessons: row.lessons.map((lesson) =>
            lesson.id === input.lessonId
              ? {
                  ...lesson,
                  videoKey: input.videoKey,
                  ...(input.durationSeconds !== null && {
                    durationSeconds: input.durationSeconds,
                  }),
                }
              : lesson,
          ),
        })
        .where(eq(workshops.id, input.id));
      return row.slug;
    });

    if (slug === null) return { saved: false as const };
    const revalidated = await revalidateStorefront(storefrontPaths(slug));
    return { saved: true as const, revalidated };
  });
