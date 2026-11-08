import { ORPCError } from "@orpc/server";
import { and, eq, reviews, sql } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { revalidateStorefront } from "../../../storefront";
import { REVIEW_PAGES } from "./pages";

/**
 * Меняет, как отзыв выглядит на сайте: показан ли он, видны ли его фото и как
 * подписан автор. Текст и оценку не правим — это слова покупателя.
 *
 * Публикуем только ту версию, которую видел проверяющий: участница может
 * изменить отзыв о мастер-классе, пока открыта таблица. `expectedUpdatedAt` —
 * отметка версии из таблицы; не совпала — CONFLICT, таблицу нужно обновить.
 */
export const update = adminProcedure
  .input(
    z.object({
      id: z.string().min(1),
      published: z.boolean().optional(),
      showPhotos: z.boolean().optional(),
      reviewerName: z.string().trim().min(1).max(80).optional(),
      expectedUpdatedAt: z.iso.datetime().optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    const { id, expectedUpdatedAt, ...fields } = input;
    const sameVersion =
      fields.published && expectedUpdatedAt
        ? // В базе микросекунды, в таблицу отметка приходит с точностью до мс
          sql`date_trunc('milliseconds', ${reviews.updatedAt}) = ${new Date(expectedUpdatedAt)}`
        : undefined;
    const [updated] = await context.db
      .update(reviews)
      .set(fields)
      .where(and(eq(reviews.id, id), sameVersion))
      .returning();
    if (!updated) {
      const [exists] = await context.db
        .select({ id: reviews.id })
        .from(reviews)
        .where(eq(reviews.id, id));
      throw exists
        ? new ORPCError("CONFLICT", {
            message:
              "Отзыв изменился после того, как открыли таблицу. Обновите страницу и проверьте его ещё раз",
          })
        : new ORPCError("NOT_FOUND", { message: "Отзыв не найден" });
    }

    const revalidated = await revalidateStorefront(REVIEW_PAGES);
    return { review: updated, revalidated };
  });
