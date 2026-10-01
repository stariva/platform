import { ORPCError } from "@orpc/server";
import { eq, workshops } from "@stariva/db";
import { isWorkshopKey } from "@stariva/storage";
import { workshopFormSchema } from "@stariva/validators";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { revalidateStorefront } from "../../../storefront";
import { formToRow, storefrontPaths } from "./mapping";

function isSlugTaken(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string; constraint?: string } })
    ?.cause;
  const pg = cause ?? (error as { code?: string; constraint?: string });
  return pg?.code === "23505" && pg.constraint === "workshops_slug_idx";
}

/**
 * Создаёт мастер-класс (без id) или сохраняет существующий, затем просит
 * витрину обновить страницы. Адрес после создания менять нельзя: на него
 * ссылаются заказы, доступы и прогресс зрителей.
 */
export const save = adminProcedure
  .input(
    z.object({
      id: z.string().min(1).optional(),
      values: workshopFormSchema,
    }),
  )
  .handler(async ({ context, input }) => {
    const { values } = input;

    // Видео и PDF берутся только из папки этого курса: иначе в форму можно
    // подставить ключ чужого объекта, и сайт выдаст на него ссылку покупателям.
    const keys = [
      ...values.lessons.map((lesson) => lesson.videoKey),
      ...values.materialFiles.map((file) => file.key),
    ].filter(Boolean);
    if (keys.some((key) => !isWorkshopKey(values.slug, key))) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Файл не из папки этого мастер-класса",
      });
    }

    const fields = formToRow(values);

    try {
      if (!input.id) {
        const [created] = await context.db
          .insert(workshops)
          .values(fields)
          .returning({ id: workshops.id });
        if (!created) throw new Error("workshop_insert_failed");
        const revalidated = await revalidateStorefront(
          storefrontPaths(values.slug),
        );
        return { id: created.id, revalidated };
      }

      const [before] = await context.db
        .select({ slug: workshops.slug })
        .from(workshops)
        .where(eq(workshops.id, input.id));
      if (!before) {
        throw new ORPCError("NOT_FOUND", {
          message: "Мастер-класс не найден",
        });
      }
      if (before.slug !== values.slug) {
        throw new ORPCError("BAD_REQUEST", {
          message:
            "Адрес мастер-класса менять нельзя: к нему привязаны покупки и прогресс",
        });
      }

      await context.db
        .update(workshops)
        .set(fields)
        .where(eq(workshops.id, input.id));
      const revalidated = await revalidateStorefront(
        storefrontPaths(values.slug),
      );
      return { id: input.id, revalidated };
    } catch (error) {
      if (isSlugTaken(error)) {
        throw new ORPCError("CONFLICT", {
          message: "Такой адрес уже занят другим мастер-классом",
        });
      }
      throw error;
    }
  });
