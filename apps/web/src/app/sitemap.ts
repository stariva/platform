import type { MetadataRoute } from "next";
import { blogPosts } from "@/lib/blog-data";
import { categories, getProducts } from "@/lib/ozon-service";
import { workshops } from "@/lib/workshops-data";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://stariva.ru";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── Статические страницы ──────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/catalog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/workshops`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/b2b`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${BASE_URL}/resort`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${BASE_URL}/offer`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/personal-data-consent`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // ── Категории каталога ────────────────────────────────────────────────────
  const categoryPages: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${BASE_URL}/catalog/${cat.slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.85,
  }));

  // ── Товары ────────────────────────────────────────────────────────────────
  const products = await getProducts();
  const productPages: MetadataRoute.Sitemap = products.map((product) => {
    const firstImage = product.images[0];
    const imageUrl = firstImage?.startsWith("http")
      ? firstImage
      : firstImage
        ? `${BASE_URL}${firstImage}`
        : undefined;

    return {
      url: `${BASE_URL}/catalog/${product.category}/${product.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: product.featured ? 0.85 : 0.75,
      ...(imageUrl
        ? {
            images: [imageUrl],
          }
        : {}),
    };
  });

  // ── Статьи блога ──────────────────────────────────────────────────────────
  const blogPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly" as const,
    // Новые статьи получают чуть выший приоритет
    priority: new Date(post.date) > new Date("2025-01-01") ? 0.7 : 0.6,
    images: [`${BASE_URL}${post.coverImage}`],
  }));

  // ── Мастер-классы ─────────────────────────────────────────────────────────
  const workshopPages: MetadataRoute.Sitemap = workshops.map((workshop) => ({
    url: `${BASE_URL}/workshops/${workshop.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: workshop.featured ? 0.8 : 0.7,
    images: [`${BASE_URL}${workshop.cover}`],
  }));

  return [
    ...staticPages,
    ...categoryPages,
    ...productPages,
    ...blogPages,
    ...workshopPages,
  ];
}
