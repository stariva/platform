import { ORPCError } from "@orpc/server";
import { eq, workshops } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { loadLessonVideos } from "./lesson-videos";
import { rowToForm } from "./mapping";

/** Мастер-класс для формы редактирования. */
export const byId = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [row] = await context.db
      .select()
      .from(workshops)
      .where(eq(workshops.id, input.id));
    if (!row) {
      throw new ORPCError("NOT_FOUND", { message: "Мастер-класс не найден" });
    }
    const videos = await loadLessonVideos(context.db, row.lessons);
    return {
      id: row.id,
      values: rowToForm(row),
      updatedAt: row.updatedAt,
      videos,
    };
  });

/**
 * Видео уроков сохранённого курса: загрузка и нарезка в HLS. Форма
 * спрашивает, пока что-то режется, чтобы статус обновлялся без перезагрузки.
 *
 * @example client.admin.workshops.videos({ id: "ws_1" })
 */
export const videos = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [row] = await context.db
      .select({ lessons: workshops.lessons })
      .from(workshops)
      .where(eq(workshops.id, input.id));
    if (!row) {
      throw new ORPCError("NOT_FOUND", { message: "Мастер-класс не найден" });
    }
    return loadLessonVideos(context.db, row.lessons);
  });
