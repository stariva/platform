import type { Review } from "./ozon-types";

export const REVIEWS_PAGE_SIZE = 12;

export interface ReviewsQuery {
  /** Только отзывы с фото покупателя */
  photos: boolean;
  /** Только отзывы с этой оценкой (1–5) */
  rating?: number;
  /** Номер страницы, с 1 */
  page: number;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Разбирает ?photos=1&rating=5&page=2; всё некорректное отбрасывает. */
export function parseReviewsQuery(params: RawSearchParams): ReviewsQuery {
  const rating = Number(first(params.rating));
  const page = Number(first(params.page));
  return {
    photos: first(params.photos) === "1",
    rating:
      Number.isInteger(rating) && rating >= 1 && rating <= 5
        ? rating
        : undefined,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** Собирает query-строку для ссылок; значения по умолчанию в неё не попадают. */
export function reviewsHref(query: Partial<ReviewsQuery>): string {
  const search = new URLSearchParams();
  if (query.photos) search.set("photos", "1");
  if (query.rating) search.set("rating", String(query.rating));
  if (query.page && query.page > 1) search.set("page", String(query.page));
  const qs = search.toString();
  return qs ? `/reviews?${qs}` : "/reviews";
}

export interface ReviewsPage {
  reviews: Review[];
  /** Сколько отзывов подошло под фильтры (без учёта страницы) */
  total: number;
  page: number;
  pageCount: number;
}

/** Применяет фильтры и режет на страницы; номер страницы за пределами зажимается. */
export function paginateReviews(
  all: Review[],
  query: ReviewsQuery,
  pageSize = REVIEWS_PAGE_SIZE,
): ReviewsPage {
  const filtered = all.filter(
    (review) =>
      (!query.photos || review.photos.length > 0) &&
      (query.rating === undefined || review.rating === query.rating),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(query.page, pageCount);
  return {
    reviews: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageCount,
  };
}

/** Номера страниц для пагинации: 1 … 4 5 6 … 20, null — «…». */
export function pageWindow(page: number, pageCount: number): (number | null)[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);
  const result: (number | null)[] = [];
  for (const [i, p] of sorted.entries()) {
    const prev = sorted[i - 1];
    if (prev !== undefined && p - prev > 1) result.push(null);
    result.push(p);
  }
  return result;
}
