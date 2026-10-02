import { env, logger } from "@stariva/config";
import { z } from "zod";

const stockSyncResponseSchema = z.object({
  updated: z.array(z.string().min(1)),
  syncedSlugs: z.array(z.string().min(1)),
  failed: z.array(z.object({ offerId: z.string(), error: z.string() })),
  hidden: z.array(z.number().int().positive()),
});

function storefrontRequest(path: string, body: unknown, timeoutMs: number) {
  const baseUrl = env.STOREFRONT_URL;
  const secret = env.REVALIDATE_SECRET;
  if (!baseUrl || !secret) return null;
  const url = new URL(path, baseUrl);
  if (url.protocol !== "https:") return null;
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/**
 * Просит витрину продублировать остаток товаров на FBS-склад Ozon (и скрыть
 * готовые изделия с витрины Ozon): без остатка на Ozon Ozon Доставка их не
 * отправит. Ключи Seller API есть только у витрины, поэтому идём через неё.
 * Возвращает false, если остаток в Ozon обновить не удалось.
 */
export async function pushStorefrontStockToOzon(
  slugs: string[],
): Promise<boolean> {
  try {
    const res = await storefrontRequest("/api/ozon/stock", { slugs }, 30_000);
    if (!res) {
      logger.warn("storefront.ozon_stock.not_configured");
      return false;
    }
    if (!res.ok) {
      logger.warn("storefront.ozon_stock.failed", { status: res.status });
      return false;
    }
    const data = stockSyncResponseSchema.parse(await res.json());
    if (
      data.failed.length > 0 ||
      slugs.length === 0 ||
      !slugs.every((slug) => data.syncedSlugs.includes(slug)) ||
      data.updated.length < new Set(slugs).size
    ) {
      logger.warn("storefront.ozon_stock.rejected", { failed: data.failed });
      return false;
    }
    return true;
  } catch (error) {
    logger.warn("storefront.ozon_stock.error", { error: String(error) });
    return false;
  }
}

/**
 * Просит витрину (stariva.ru) сбросить кэш страниц после правок каталога.
 * Без настроек или при сбое — только предупреждение: страницы товаров всё
 * равно обновятся сами в течение часа.
 */
export async function revalidateStorefront(paths: string[]): Promise<boolean> {
  try {
    const res = await storefrontRequest(
      "/api/revalidate",
      { paths: [...new Set(paths)] },
      5000,
    );
    if (!res) {
      logger.warn("storefront.revalidate.not_configured");
      return false;
    }
    if (!res.ok) {
      logger.warn("storefront.revalidate.failed", { status: res.status });
    }
    return res.ok;
  } catch (error) {
    logger.warn("storefront.revalidate.error", { error: String(error) });
    return false;
  }
}
