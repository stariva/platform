import { logger } from "@stariva/config";
import { cache } from "react";
import { OZON_REVIEWS } from "@/data/ozon-reviews";
import { fetchPublishedProducts } from "./catalog/products-db";
import { scheduleStockSync } from "./catalog/stock-sync";
import { isPurchasable } from "./in-stock";
import { fetchOzonReviews } from "./ozon/api-client";
import type { Product, Review } from "./ozon-types";
import { categories } from "./products";

export interface ProductsResult {
  products: Product[];
  status: "available" | "unavailable";
}

/**
 * Каталог из своей базы (таблица products). Ozon остаётся только складом и
 * доставкой готовых изделий. Один запрос на рендер: страница, метаданные и
 * отзывы берут товары из одного результата.
 */
export const getProductsResult = cache(async (): Promise<ProductsResult> => {
  try {
    const products = await fetchPublishedProducts();
    // Остатки FBS сверяем с Ozon после ответа, не задерживая страницу
    scheduleStockSync();
    return { products, status: "available" };
  } catch (error) {
    // База недоступна (в том числе при сборке образа) — это сбой, а не пустой
    // каталог: страницы показывают «каталог временно недоступен».
    logger.warn("catalog.products.unavailable", { error: String(error) });
    return { products: [], status: "unavailable" };
  }
});

export async function getProducts(): Promise<Product[]> {
  return (await getProductsResult()).products;
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

/** Готовые изделия, которые можно сразу купить на сайте. */
export async function getInStockProducts(): Promise<Product[]> {
  return (await getInStockProductsResult()).products;
}

export async function getInStockProductsResult(): Promise<ProductsResult> {
  const result = await getProductsResult();
  return { ...result, products: result.products.filter(isPurchasable) };
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
  /** SKU товара — фильтр живых отзывов из Seller API (когда он доступен по подписке) */
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

/** Рейтинг по отзывам Ozon из того же набора, что показывается на сайте. */
export async function getRatingSummary(
  offerId?: string,
  skus?: number[],
): Promise<RatingSummary | null> {
  const reviews = await getReviews({ offerId, skus });
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((total, review) => total + review.rating, 0);
  return { average: sum / reviews.length, count: reviews.length };
}

export { categories } from "./products";
