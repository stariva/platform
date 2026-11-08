import { ORPCError } from "@orpc/server";
import { eq, reviews } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { revalidateStorefront } from "../../../storefront";
import { REVIEW_PAGES } from "./pages";

/**
 * Удаляет отзыв насовсем. Связи с товарами уходят каскадом. Чтобы просто
 * убрать отзыв с сайта, достаточно снять «На сайте» — удаление нужно для
 * спама и ошибочных отзывов. Фото в бакете остаются.
 *
 * Участница, чей отзыв о мастер-классе удалён, сможет оставить новый: уникален
 * только отзыв на пару «пользователь — курс», а он освобождается.
 */
export const remove = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [deleted] = await context.db
      .delete(reviews)
      .where(eq(reviews.id, input.id))
      .returning({ id: reviews.id });
    if (!deleted) {
      throw new ORPCError("NOT_FOUND", { message: "Отзыв не найден" });
    }

    const revalidated = await revalidateStorefront(REVIEW_PAGES);
    return { id: deleted.id, revalidated };
  });
