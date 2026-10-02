import { logger } from "@stariva/config";
import { and, db, inArray, isNotNull } from "@stariva/db";
import { products } from "@stariva/db/schema";
import { z } from "zod";
import { env } from "@/env";

const OZON_API_URL = "https://api-seller.ozon.ru";
// Ограничение Ozon: до 100 пар товар-склад и до 100 SKU видимости за запрос
const BATCH_SIZE = 100;

const stocksResponseSchema = z.object({
  result: z.array(
    z.object({
      offer_id: z.string().optional(),
      updated: z.boolean(),
      errors: z
        .array(z.object({ code: z.string(), message: z.string().optional() }))
        .optional(),
    }),
  ),
});
const visibilityResponseSchema = z.object({
  items_errors: z
    .array(z.object({ code: z.string(), sku: z.coerce.number() }))
    .optional(),
});

export interface OzonStockPushResult {
  /** Артикулы, остаток которых Ozon принял. */
  updated: string[];
  /** Товары с подтверждённым остатком и требуемым скрытием. */
  syncedSlugs: string[];
  /** Ошибки обновления остатка или скрытия с витрины. */
  failed: { offerId: string; error: string }[];
  /** SKU, скрытые с витрин Ozon и Селект. */
  hidden: number[];
}

async function ozonSellerFetch<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  const clientId = env.OZON_CLIENT_ID;
  const apiKey = env.OZON_API_KEY;
  if (!clientId || !apiKey) throw new Error("ozon_seller_not_configured");

  const res = await fetch(`${OZON_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Id": clientId,
      "Api-Key": apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ozon_seller_request_failed_${res.status}: ${detail}`);
  }
  return schema.parse(await res.json());
}

function chunks<T>(items: T[]): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    result.push(items.slice(i, i + BATCH_SIZE));
  }
  return result;
}

function stockQuery(slugs?: string[]) {
  return db
    .select({
      slug: products.slug,
      ozonProductId: products.ozonProductId,
      ozonOfferId: products.ozonOfferId,
      ozonSku: products.ozonSku,
      stockAvailable: products.stockAvailable,
    })
    .from(products)
    .where(
      and(
        isNotNull(products.ozonOfferId),
        slugs ? inArray(products.slug, slugs) : undefined,
      ),
    );
}

/**
 * Дублирует остаток готовых изделий из нашей БД на FBS-склад Ozon и скрывает
 * такие товары с витрин Ozon. Ozon Доставка продаёт только то, что числится
 * в остатке на Ozon, а на маркетплейсе эти изделия продавать не нужно.
 *
 * Скрытие одностороннее: когда остаток кончился, товар остаётся скрытым —
 * на маркетплейс готовые изделия возвращаются вручную в кабинете Ozon.
 *
 * Без `slugs` отправляет все товары с артикулом Ozon, включая нулевой остаток.
 */
export async function pushStockToOzon(
  slugs?: string[],
): Promise<OzonStockPushResult> {
  while (true) {
    const rows = await stockQuery(slugs);
    const outcome = await pushStockSnapshotToOzon(rows).then(
      (result) => ({ result }),
      (error: unknown) => ({ error }),
    );
    // Проверяем именно отправленный снимок: параллельное сохранение могло
    // отправить новый остаток раньше нашего запроса. В таком случае повторяем.
    const latest = await stockQuery(slugs);
    if (
      rows.length === latest.length &&
      rows.every((row) =>
        latest.some(
          (current) =>
            current.slug === row.slug &&
            current.stockAvailable === row.stockAvailable &&
            current.ozonOfferId === row.ozonOfferId &&
            current.ozonSku === row.ozonSku &&
            current.ozonProductId === row.ozonProductId,
        ),
      )
    ) {
      if ("error" in outcome) throw outcome.error;
      return outcome.result;
    }
  }
}

async function pushStockSnapshotToOzon(
  rows: Awaited<ReturnType<typeof stockQuery>>,
): Promise<OzonStockPushResult> {
  const result: OzonStockPushResult = {
    updated: [],
    syncedSlugs: [],
    failed: [],
    hidden: [],
  };
  if (rows.length === 0) return result;

  for (const batch of chunks(rows)) {
    const data = await ozonSellerFetch(
      "/v2/products/stocks",
      {
        stocks: batch.map((row) => ({
          offer_id: row.ozonOfferId,
          ...(row.ozonProductId !== null && { product_id: row.ozonProductId }),
          stock: row.stockAvailable,
          warehouse_id: env.OZON_FBS_WAREHOUSE_ID,
        })),
      },
      stocksResponseSchema,
    );
    for (const item of data.result) {
      const offerId = item.offer_id ?? "";
      if (item.updated) {
        result.updated.push(offerId);
      } else {
        const error =
          item.errors?.map((e) => e.message || e.code).join("; ") ||
          "not_updated";
        result.failed.push({ offerId, error });
      }
    }
  }

  const toHide = rows
    .filter((row) => row.stockAvailable > 0 && row.ozonSku !== null)
    .map((row) => row.ozonSku as number);
  for (const batch of chunks(toHide)) {
    const data = await ozonSellerFetch(
      "/v1/product/visibility/set",
      { item_placement: batch.map((sku) => ({ sku, placement: "NONE" })) },
      visibilityResponseSchema,
    );
    const failedSkus = new Set(data.items_errors?.map((e) => e.sku));
    for (const error of data.items_errors ?? []) {
      result.failed.push({
        offerId:
          rows.find((row) => row.ozonSku === error.sku)?.ozonOfferId ?? "",
        error: `visibility_${error.code} (SKU ${error.sku})`,
      });
      logger.warn("ozon.visibility.failed", {
        sku: error.sku,
        code: error.code,
      });
    }
    result.hidden.push(...batch.filter((sku) => !failedSkus.has(sku)));
  }

  result.syncedSlugs = rows
    .filter(
      (row) =>
        row.ozonOfferId !== null &&
        result.updated.includes(row.ozonOfferId) &&
        !result.failed.some((failure) => failure.offerId === row.ozonOfferId) &&
        (row.stockAvailable === 0 ||
          (row.ozonSku !== null && result.hidden.includes(row.ozonSku))),
    )
    .map((row) => row.slug);

  if (result.failed.length > 0) {
    logger.warn("ozon.stock.push_failed", { failed: result.failed });
  }
  return result;
}
