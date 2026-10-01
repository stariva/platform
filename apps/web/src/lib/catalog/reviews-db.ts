import { db, desc, eq } from "@stariva/db";
import { reviewProducts, reviews } from "@stariva/db/schema";
import type { Review } from "@/lib/ozon-types";
import { reviewRowToReview } from "./review-row";

/** Отзывы, отмеченные в админке для показа на сайте, — новые сверху. */
export async function fetchPublishedReviews(): Promise<Review[]> {
  const [rows, links] = await Promise.all([
    db
      .select()
      .from(reviews)
      .where(eq(reviews.published, true))
      .orderBy(desc(reviews.reviewedAt)),
    db.select().from(reviewProducts),
  ]);

  const productIds = new Map<string, string[]>();
  for (const { reviewId, productId } of links) {
    productIds.set(reviewId, [...(productIds.get(reviewId) ?? []), productId]);
  }
  return rows.map((row) => reviewRowToReview(row, productIds.get(row.id)));
}
