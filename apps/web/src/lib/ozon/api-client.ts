import { logger } from "@stariva/config";
import { z } from "zod";
import { env } from "@/env";
import type { Product } from "../ozon-types";
import type { ExtractedAttributes, OzonProductInfoV3 } from "./transformers";
import {
  extractAttributes,
  ozonProductInfoV3Schema,
  transformOzonProduct,
} from "./transformers";

const OZON_API_URL = "https://api-seller.ozon.ru";

interface OzonProductListResponse {
  result: {
    items: { product_id: number; offer_id: string }[];
    total: number;
    last_id: string;
  };
}

async function fetchProductIdsByVisibility(
  visibility: "ALL" | "ARCHIVED",
  clientId: string,
  apiKey: string,
): Promise<number[] | null> {
  const res = await fetch(`${OZON_API_URL}/v3/product/list`, {
    signal: AbortSignal.timeout(6000),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Id": clientId,
      "Api-Key": apiKey,
    },
    body: JSON.stringify({
      filter: { visibility },
      last_id: "",
      limit: 100,
    }),
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const text = await res.text();
    logger.warn("ozon.list.failed", { visibility, status: res.status, text });
    return null;
  }

  const data: OzonProductListResponse = await res.json();
  return data.result.items.map((item) => item.product_id);
}

async function fetchProductIds(
  clientId: string,
  apiKey: string,
): Promise<number[] | null> {
  // "ALL" возвращает все товары, кроме архивных — Ozon у нас выступает
  // как админка товаров, поэтому архивные/недоступные к покупке товары
  // тоже должны отображаться на сайте, их нужно запрашивать отдельно.
  const [active, archived] = await Promise.all([
    fetchProductIdsByVisibility("ALL", clientId, apiKey),
    fetchProductIdsByVisibility("ARCHIVED", clientId, apiKey),
  ]);

  if (active === null && archived === null) return null;

  const ids = new Set([...(active ?? []), ...(archived ?? [])]);
  return [...ids];
}

async function fetchProductDetails(
  productIds: number[],
  clientId: string,
  apiKey: string,
): Promise<OzonProductInfoV3[] | null> {
  const res = await fetch(`${OZON_API_URL}/v3/product/info/list`, {
    signal: AbortSignal.timeout(6000),
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
    logger.warn("ozon.info.failed", { status: res.status, text });
    return null;
  }

  const responseSchema = z.looseObject({
    items: z.array(ozonProductInfoV3Schema).optional(),
    result: z
      .looseObject({ items: z.array(ozonProductInfoV3Schema).optional() })
      .optional(),
  });
  const parsed = responseSchema.safeParse(await res.json());
  if (!parsed.success) {
    logger.warn("ozon.info.validation_failed");
    return null;
  }
  const items: OzonProductInfoV3[] =
    parsed.data.items ?? parsed.data.result?.items ?? [];
  return items;
}

async function fetchProductAttributesByVisibility(
  visibility: "ALL" | "ARCHIVED",
  productIds: number[],
  clientId: string,
  apiKey: string,
): Promise<
  {
    id: number;
    attributes?: {
      id?: number;
      attribute_id?: number;
      values?: { value?: string }[];
    }[];
  }[]
> {
  const res = await fetch(`${OZON_API_URL}/v4/product/info/attributes`, {
    signal: AbortSignal.timeout(6000),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Id": clientId,
      "Api-Key": apiKey,
    },
    body: JSON.stringify({
      filter: { product_id: productIds, visibility },
      last_id: "",
      limit: 100,
      sort_by: "",
      sort_dir: "",
    }),
    next: { revalidate: 3600 },
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.result ?? [];
}

async function fetchProductAttributes(
  productIds: number[],
  clientId: string,
  apiKey: string,
): Promise<Map<number, ExtractedAttributes>> {
  try {
    // Как и со списком товаров, "ALL" не включает архивные — запрашиваем
    // атрибуты обоими фильтрами, чтобы у архивных товаров тоже был материал/цвет/размеры.
    const [active, archived] = await Promise.all([
      fetchProductAttributesByVisibility("ALL", productIds, clientId, apiKey),
      fetchProductAttributesByVisibility(
        "ARCHIVED",
        productIds,
        clientId,
        apiKey,
      ),
    ]);

    const result = new Map<number, ExtractedAttributes>();
    for (const item of [...active, ...archived]) {
      result.set(item.id, extractAttributes(item.attributes ?? []));
    }
    return result;
  } catch {
    return new Map();
  }
}

// ─── Products ─────────────────────────────────────────────────────────────────

export interface OzonCatalogItem {
  info: OzonProductInfoV3;
  attrs?: ExtractedAttributes;
}

/** Товары Ozon в исходном виде — с поштучными остатками, до перевода в Product. */
export async function fetchOzonCatalog(): Promise<OzonCatalogItem[] | null> {
  const clientId = env.OZON_CLIENT_ID;
  const apiKey = env.OZON_API_KEY;

  if (!clientId || !apiKey) {
    return null;
  }

  try {
    const productIds = await fetchProductIds(clientId, apiKey);
    if (productIds === null) return null;
    if (productIds.length === 0) {
      return [];
    }

    const items = await fetchProductDetails(productIds, clientId, apiKey);
    if (!items) return null;
    if (items.length === 0) {
      return [];
    }

    const attrsMap = await fetchProductAttributes(productIds, clientId, apiKey);

    return items.map((info) => ({ info, attrs: attrsMap.get(info.id) }));
  } catch (error) {
    logger.error("ozon.fetch.error", error);
    return null;
  }
}

/**
 * Преобразует каталог Ozon в товары витрины; возвращает null при недоступности
 * каталога или отсутствии учётных данных и пустой массив, если товаров нет.
 */
export async function fetchFromOzon(): Promise<Product[] | null> {
  const catalog = await fetchOzonCatalog();
  return (
    catalog?.map(({ info, attrs }) => transformOzonProduct(info, attrs)) ?? null
  );
}
