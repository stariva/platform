import { ORPCError } from "@orpc/server";
import { eq, reviews } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { revalidateStorefront } from "../../../storefront";
import { REVIEW_PAGES } from "./pages";

/**
 * Меняет, как отзыв выглядит на сайте: показан ли он, видны ли его фото и как
 * подписан автор. Текст и оценку не правим — это слова покупателя.
 */
export const update = adminProcedure
  .input(
    z.object({
      id: z.string().min(1),
      published: z.boolean().optional(),
      showPhotos: z.boolean().optional(),
      reviewerName: z.string().trim().min(1).max(80).optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    const { id, ...fields } = input;
    const [updated] = await context.db
      .update(reviews)
      .set(fields)
      .where(eq(reviews.id, id))
      .returning();
    if (!updated) {
      throw new ORPCError("NOT_FOUND", { message: "Отзыв не найден" });
    }

    const revalidated = await revalidateStorefront(REVIEW_PAGES);
    return { review: updated, revalidated };
  });
