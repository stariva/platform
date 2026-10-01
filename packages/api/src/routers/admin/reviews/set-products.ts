import { ORPCError } from "@orpc/server";
import {
  and,
  eq,
  inArray,
  notInArray,
  products,
  reviewProducts,
  reviews,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { revalidateStorefront } from "../../../storefront";
import { REVIEW_PAGES } from "./pages";

/**
 * Задаёт товары, на карточках которых показывается отзыв. Пустой список —
 * отзыв о мастерской, он остаётся только в общих блоках.
 */
export const setProducts = adminProcedure
  .input(
    z.object({
      id: z.string().min(1),
      productIds: z.array(z.string().min(1)).max(50),
    }),
  )
  .handler(async ({ context, input }) => {
    const productIds = [...new Set(input.productIds)];

    const [review] = await context.db
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.id, input.id));
    if (!review) {
      throw new ORPCError("NOT_FOUND", { message: "Отзыв не найден" });
    }
    if (productIds.length > 0) {
      const found = await context.db
        .select({ id: products.id })
        .from(products)
        .where(inArray(products.id, productIds));
      if (found.length !== productIds.length) {
        throw new ORPCError("BAD_REQUEST", { message: "Товар не найден" });
      }
    }

    // Без транзакции (neon-http её не умеет): сначала снимаем лишние связи,
    // потом добавляем новые — повтор запроса доводит связи до нужных
    await context.db
      .delete(reviewProducts)
      .where(
        productIds.length > 0
          ? and(
              eq(reviewProducts.reviewId, input.id),
              notInArray(reviewProducts.productId, productIds),
            )
          : eq(reviewProducts.reviewId, input.id),
      );
    if (productIds.length > 0) {
      await context.db
        .insert(reviewProducts)
        .values(
          productIds.map((productId) => ({ reviewId: input.id, productId })),
        )
        .onConflictDoNothing();
    }

    const revalidated = await revalidateStorefront(REVIEW_PAGES);
    return { productIds, revalidated };
  });
