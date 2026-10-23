import { ORPCError } from "@orpc/server";
import { eq, workshops } from "@stariva/db";
import { isStorageConfigured, objectLastModified } from "@stariva/storage";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { rowToForm } from "./mapping";

/**
 * Когда загрузили видео уроков: videoKey → время из бакета. Видео, которое
 * не удалось проверить, просто без даты — форма от этого не ломается.
 */
async function videoUploadDates(
  videoKeys: string[],
): Promise<Record<string, Date>> {
  if (!isStorageConfigured()) return {};
  const dates = await Promise.all(
    videoKeys.map((key) => objectLastModified(key).catch(() => null)),
  );
  return Object.fromEntries(
    videoKeys.flatMap((key, i) => {
      const date = dates[i];
      return date ? [[key, date]] : [];
    }),
  );
}

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
    const videoUploadedAt = await videoUploadDates(
      row.lessons.map((lesson) => lesson.videoKey).filter(Boolean),
    );
    return {
      id: row.id,
      values: rowToForm(row),
      updatedAt: row.updatedAt,
      videoUploadedAt,
    };
  });
