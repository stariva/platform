import { db, desc, eq } from "@stariva/db";
import { reviews } from "@stariva/db/schema";
import type { Review } from "@/lib/ozon-types";
import { reviewRowToReview } from "./review-row";

/** Отзывы, отмеченные в админке для показа на сайте, — новые сверху. */
export async function fetchPublishedReviews(): Promise<Review[]> {
  const rows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.published, true))
    .orderBy(desc(reviews.reviewedAt));
  return rows.map(reviewRowToReview);
}
