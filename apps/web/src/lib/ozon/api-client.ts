import { env } from "@/env";
import type { OzonReview, Product, Review } from "../ozon-types";
import type { ExtractedAttributes, OzonProductInfoV3 } from "./transformers";
import { extractAttributes, transformOzonProduct } from "./transformers";

const OZON_API_URL = "https://api-seller.ozon.ru";

interface OzonProductListResponse {
  result: {
    items: { product_id: number; offer_id: string }[];
    total: number;
    last_id: string;
  };
}

async function fetchProductIds(
  clientId: string,
  apiKey: string,
): Promise<number[] | null> {
  console.log("[v0] Fetching Ozon product list...");

  const res = await fetch(`${OZON_API_URL}/v3/product/list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Id": clientId,
      "Api-Key": apiKey,
    },
    body: JSON.stringify({
      filter: { visibility: "ALL" },
      last_id: "",
      limit: 100,
    }),
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const text = await res.text();
    console.log("[v0] Ozon list request failed:", res.status, text);
    return null;
  }

  const data: OzonProductListResponse = await res.json();
  console.log("[v0] Found", data.result.items.length, "products in Ozon");
  return data.result.items.map((item) => item.product_id);
}

async function fetchProductDetails(
  productIds: number[],
  clientId: string,
  apiKey: string,
): Promise<OzonProductInfoV3[] | null> {
  console.log(
    "[v0] Fetching product details for",
    productIds.length,
    "products...",
  );

  const res = await fetch(`${OZON_API_URL}/v3/product/info/list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Id": clientId,
      "Api-Key": apiKey,
    },
    body: JSON.stringify({ product_id: productIds }),
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const text = await res.text();
    console.log("[v0] Ozon info request failed:", res.status, text);
    return null;
  }

  const data = await res.json();
  const items: OzonProductInfoV3[] = data.items || data.result?.items || [];
  console.log("[v0] Successfully fetched", items.length, "product details");
  return items;
}

async function fetchProductAttributes(
  productIds: number[],
  clientId: string,
  apiKey: string,
): Promise<Map<number, ExtractedAttributes>> {
  try {
    const res = await fetch(`${OZON_API_URL}/v4/product/info/attributes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": clientId,
        "Api-Key": apiKey,
      },
      body: JSON.stringify({
        filter: { product_id: productIds, visibility: "ALL" },
        last_id: "",
        limit: 100,
        sort_by: "",
        sort_dir: "",
      }),
      next: { revalidate: 3600 },
    });

    if (!res.ok) return new Map();

    const data = await res.json();
    const result = new Map<number, ExtractedAttributes>();
    for (const item of data.result ?? []) {
      result.set(item.id, extractAttributes(item.attributes ?? []));
    }
    return result;
  } catch {
    return new Map();
  }
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

function transformOzonReview(raw: OzonReview): Review {
  return {
    id: raw.uuid,
    rating: raw.rating,
    text: raw.text,
    date: raw.created_at,
    reviewerName: raw.reviewer_name ?? "Покупатель",
    productSku: raw.sku,
    photos: (raw.media ?? []).map((m) => m.url),
    source: "ozon",
  };
}

/**
 * Fetches published reviews from Ozon Seller API.
 * Returns null if credentials are missing or the request fails.
 * Revalidates every 4 hours (ISR).
 */
export async function fetchOzonReviews(
  limit = 20,
  skus?: number[],
): Promise<Review[] | null> {
  const clientId = env.OZON_CLIENT_ID;
  const apiKey = env.OZON_API_KEY;

  if (!clientId || !apiKey) {
    return null;
  }

  try {
    const body: Record<string, unknown> = {
      limit,
      sort_by: "created_at",
      sort_dir: "DESC",
    };
    if (skus && skus.length > 0) {
      body.skus = skus;
    }

    const res = await fetch(`${OZON_API_URL}/v1/review/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": clientId,
        "Api-Key": apiKey,
      },
      body: JSON.stringify(body),
      next: { revalidate: 14400 }, // 4 hours
    });

    if (!res.ok) {
      if (res.status === 403) {
        // Subscription doesn't include reviews API — skip silently
        return null;
      }
      const text = await res.text();
      console.log("[ozon] Reviews request failed:", res.status, text);
      return null;
    }

    const data = await res.json();
    // API returns { reviews: [...] } or { result: { reviews: [...] } }
    const raw: OzonReview[] = data.reviews ?? data.result?.reviews ?? [];
    const published = raw.filter(
      (r) => r.status === "published" && r.text?.trim(),
    );
    return published.map(transformOzonReview);
  } catch (error) {
    console.log(
      "[ozon] Reviews fetch error:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function fetchFromOzon(): Promise<Product[] | null> {
  const clientId = env.OZON_CLIENT_ID;
  const apiKey = env.OZON_API_KEY;

  if (!clientId || !apiKey) {
    console.log("[v0] Ozon credentials not configured, skipping fetch");
    return null;
  }

  console.log(
    "[v0] Ozon credentials found. Client ID starts with:",
    `${clientId.substring(0, 5)}...`,
  );

  try {
    const productIds = await fetchProductIds(clientId, apiKey);
    if (productIds === null) return null;
    if (productIds.length === 0) {
      console.log("[v0] No products found in Ozon account");
      return [];
    }

    const items = await fetchProductDetails(productIds, clientId, apiKey);
    if (!items) return null;
    if (items.length === 0) {
      console.log("[v0] No product details returned");
      return [];
    }

    console.log("[v0] Fetching product attributes...");
    const attrsMap = await fetchProductAttributes(productIds, clientId, apiKey);
    console.log("[v0] Attributes fetched for", attrsMap.size, "products");

    const products = items.map((item) =>
      transformOzonProduct(item, attrsMap.get(item.id)),
    );
    console.log("[v0] Transformed", products.length, "products for display");
    return products;
  } catch (error) {
    console.log(
      "[v0] Ozon API error:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
