import { logger } from "@stariva/config";
import { OZON_RATINGS, OZON_REVIEWS } from "@/data/ozon-reviews";
import { fetchFromOzon, fetchOzonReviews } from "./ozon/api-client";
import type { Product, Review } from "./ozon-types";
import { categories } from "./products";

export async function getProducts(): Promise<Product[]> {
  const ozonProducts = await fetchFromOzon();

  if (ozonProducts && ozonProducts.length > 0) {
    return ozonProducts;
  }

  logger.warn("ozon.products.unavailable");
  return [];
}

export async function getProductsByCategory(
  category: string,
): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((p) => p.category === category);
}

export async function getProductsBySubcategory(
  subcategory: string,
): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((p) => p.subcategory === subcategory);
}

export async function getProductBySlug(
  slug: string,
): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find((p) => p.slug === slug);
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const products = await getProducts();
  const featured = products.filter((p) => p.featured);
  if (featured.length > 0) return featured;

  const result: Product[] = [];
  for (const cat of categories) {
    const catProducts = products.filter((p) => p.category === cat.slug);
    if (catProducts[0]) result.push(catProducts[0]);
  }
  return result.slice(0, 3);
}

export interface ReviewFilter {
  /** Артикул товара (offer_id) — отзывы из снимка кабинета продавца */
  offerId?: string;
  /** SKU товара — отзывы из Seller API (когда он доступен по подписке) */
  skus?: number[];
}

/**
 * Отзывы с Ozon: живые из Seller API (если подписка позволяет) плюс снимок
 * из кабинета продавца. Без фильтра — лучшие отзывы магазина: сначала с фото
 * и развёрнутым текстом.
 */
export async function getReviews(filter: ReviewFilter = {}): Promise<Review[]> {
  const { offerId, skus } = filter;
  const isProductPage = Boolean(offerId || skus?.length);

  const live = (await fetchOzonReviews(100)) ?? [];
  const liveMatched = isProductPage
    ? live.filter(
        (r) => r.productSku !== undefined && skus?.includes(r.productSku),
      )
    : live;
  const snapshot = isProductPage
    ? OZON_REVIEWS.filter((r) => offerId && r.productOfferId === offerId)
    : OZON_REVIEWS;

  const seen = new Set<string>();
  const merged = [...liveMatched, ...snapshot].filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  const byDate = (a: Review, b: Review) => b.date.localeCompare(a.date);
  if (isProductPage) return merged.sort(byDate);

  const score = (r: Review) =>
    (r.rating === 5 ? 2 : 0) +
    (r.photos.length > 0 ? 2 : 0) +
    (r.text.length >= 80 ? 1 : 0);
  const ranked = merged.sort((a, b) => score(b) - score(a) || byDate(a, b));

  // Сначала по одному отзыву на вид товара, чтобы в блоке не было пяти поясов подряд
  const seenProducts = new Set<string>();
  const firstPerProduct: Review[] = [];
  const rest: Review[] = [];
  for (const r of ranked) {
    // По названию: у разных расцветок пояса разные артикулы, но один «Пояс»
    const key = r.productTitle ?? r.productOfferId ?? r.id;
    if (seenProducts.has(key)) {
      rest.push(r);
    } else {
      seenProducts.add(key);
      firstPerProduct.push(r);
    }
  }
  return [...firstPerProduct, ...rest];
}

export interface RatingSummary {
  average: number;
  count: number;
}

/** Рейтинг по всем оценкам Ozon (включая оценки без текста). */
export function getRatingSummary(offerId?: string): RatingSummary | null {
  const single = offerId ? OZON_RATINGS[offerId] : undefined;
  const entries = offerId
    ? single
      ? [single]
      : []
    : Object.values(OZON_RATINGS);
  const count = entries.reduce((n, e) => n + e.count, 0);
  if (count === 0) return null;
  const sum = entries.reduce((n, e) => n + e.sum, 0);
  return { average: sum / count, count };
}

export { categories } from "./products";
