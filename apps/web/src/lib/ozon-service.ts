import { logger } from "@stariva/config";
import { cache } from "react";
import { fetchPublishedProducts } from "./catalog/products-db";
import { fetchPublishedReviews } from "./catalog/reviews-db";
import { isPurchasable } from "./in-stock";
import type { Product, Review } from "./ozon-types";
import { categories } from "./products";

export interface ProductsResult {
  products: Product[];
  status: "available" | "unavailable";
}

/**
 * Каталог и остатки — из своей базы (таблица products). Ozon нужен только для
 * доставки готовых изделий. Один запрос на рендер: страница, метаданные и
 * отзывы берут товары из одного результата.
 */
export const getProductsResult = cache(async (): Promise<ProductsResult> => {
  try {
    const products = await fetchPublishedProducts();
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
  /** Наш товар (products.id) — отзывы только на него */
  productId?: string;
}

/**
 * Отзывы, которые мы сами отметили для показа в админке. Без фильтра — лучшие
 * отзывы магазина: сначала с фото и развёрнутым текстом. Один запрос к базе на
 * рендер, как и у каталога.
 */
const getPublishedReviews = cache(async (): Promise<Review[]> => {
  try {
    return await fetchPublishedReviews();
  } catch (error) {
    // Нет базы — просто не показываем отзывы, страница от этого не падает
    logger.warn("catalog.reviews.unavailable", { error: String(error) });
    return [];
  }
});

export async function getReviews(filter: ReviewFilter = {}): Promise<Review[]> {
  const { productId } = filter;
  const all = await getPublishedReviews();

  const byDate = (a: Review, b: Review) => b.date.localeCompare(a.date);
  if (productId) {
    return all.filter((r) => r.productIds.includes(productId)).sort(byDate);
  }

  const score = (r: Review) =>
    (r.rating === 5 ? 2 : 0) +
    (r.photos.length > 0 ? 2 : 0) +
    (r.text.length >= 80 ? 1 : 0);
  const ranked = [...all].sort((a, b) => score(b) - score(a) || byDate(a, b));

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

/** Все опубликованные отзывы магазина, новые сверху — для страницы /reviews. */
export async function getAllReviews({
  verifiedOnly = false,
}: {
  /** Только отзывы с маркетплейсов (Ozon, Авито), без оставленных на сайте */
  verifiedOnly?: boolean;
} = {}): Promise<Review[]> {
  const all = await getPublishedReviews();
  return all
    .filter((review) => !verifiedOnly || review.source !== "site")
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface RatingSummary {
  average: number;
  count: number;
  /** Откуда оценки — для подписи «на Ozon и Авито» */
  sources: Review["source"][];
}

/** Средняя оценка по списку отзывов; null, если отзывов нет. */
export function summarizeRatings(reviews: Review[]): RatingSummary | null {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((total, review) => total + review.rating, 0);
  const sources = new Set(reviews.map((review) => review.source));
  return {
    average: sum / reviews.length,
    count: reviews.length,
    sources: (["ozon", "avito", "site"] as const).filter((s) => sources.has(s)),
  };
}

/** Рейтинг по тем же отзывам, что показываются на сайте. */
export async function getRatingSummary(
  productId?: string,
): Promise<RatingSummary | null> {
  return summarizeRatings(await getReviews({ productId }));
}

export { categories } from "./products";
