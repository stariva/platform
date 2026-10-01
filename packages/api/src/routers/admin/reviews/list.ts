import { desc, reviewProducts, reviews } from "@stariva/db";

import { adminProcedure } from "../../../orpc";

/** Все отзывы, включая скрытые, — новые сверху, с привязанными товарами. */
export const list = adminProcedure.handler(async ({ context }) => {
  const [rows, links] = await Promise.all([
    context.db.select().from(reviews).orderBy(desc(reviews.reviewedAt)),
    context.db.select().from(reviewProducts),
  ]);

  const productIds = new Map<string, string[]>();
  for (const { reviewId, productId } of links) {
    productIds.set(reviewId, [...(productIds.get(reviewId) ?? []), productId]);
  }
  return rows.map((row) => ({
    ...row,
    productIds: productIds.get(row.id) ?? [],
  }));
});
