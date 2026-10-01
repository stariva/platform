import type { ReviewRow } from "@stariva/db/schema";
import type { Review } from "@/lib/ozon-types";

/** Строка reviews → отзыв витрины. Скрытые фото на сайт не попадают. */
export function reviewRowToReview(
  row: ReviewRow,
  productIds: string[] = [],
): Review {
  return {
    id: row.id,
    rating: row.rating,
    text: row.text,
    date: row.reviewedAt.toISOString(),
    reviewerName: row.reviewerName,
    productOfferId: row.productOfferId ?? undefined,
    productTitle: row.productTitle ?? undefined,
    productIds,
    photos: row.showPhotos ? row.photos : [],
    source: row.source,
  };
}
