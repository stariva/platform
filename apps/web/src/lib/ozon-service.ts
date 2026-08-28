import { logger } from "@stariva/config";
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

/**
 * Fetches reviews from Ozon, returning an empty array on failure.
 * Optionally filter by SKU list for per-product reviews.
 */
export async function getReviews(skus?: number[]): Promise<Review[]> {
  const reviews = await fetchOzonReviews(20, skus);
  return reviews ?? [];
}

export { categories } from "./products";
