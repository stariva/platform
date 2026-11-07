import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { TimeoutLinkPlugin } from "@orpc/client/plugins";
import { env, logger } from "@stariva/config";
import { WEB_RPC_PATH, type WebClient } from "@stariva/web-api/contract";

/** Адрес витрины и общий секрет; null без настроек или не по HTTPS. */
function storefrontTarget() {
  const baseUrl = env.STOREFRONT_URL;
  const secret = env.REVALIDATE_SECRET;
  if (!baseUrl || !secret) return null;
  const url = new URL(baseUrl);
  if (url.protocol !== "https:") return null;
  return { origin: url.origin, secret };
}

/** Типизированный клиент API витрины (@stariva/web-api) с секретом админки. */
function storefrontApi(timeoutMs: number): WebClient | null {
  const target = storefrontTarget();
  if (!target) return null;
  return createORPCClient(
    new RPCLink({
      origin: target.origin,
      url: WEB_RPC_PATH,
      headers: { authorization: `Bearer ${target.secret}` },
      plugins: [new TimeoutLinkPlugin({ timeout: timeoutMs })],
    }),
  );
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
  if (slugs.length === 0) return false;
  try {
    const api = storefrontApi(30_000);
    if (!api) {
      logger.warn("storefront.ozon_stock.not_configured");
      return false;
    }
    const data = await api.admin.ozon.pushStock({ slugs });
    if (
      data.failed.length > 0 ||
      !slugs.every((slug) => data.syncedSlugs.includes(slug)) ||
      data.updated.length < new Set(slugs).size
    ) {
      logger.warn("storefront.ozon_stock.rejected", { failed: data.failed });
      return false;
    }
    return true;
  } catch (error) {
    logger.warn("storefront.ozon_stock.failed", {
      code: error instanceof ORPCError ? error.code : undefined,
      error: String(error),
    });
    return false;
  }
}

/**
 * Просит витрину (stariva.ru) сбросить кэш страниц после правок каталога.
 * Без настроек или при сбое — только предупреждение: страницы товаров всё
 * равно обновятся сами в течение часа.
 */
export async function revalidateStorefront(paths: string[]): Promise<boolean> {
  if (paths.length === 0) return false;
  try {
    const api = storefrontApi(5000);
    if (!api) {
      logger.warn("storefront.revalidate.not_configured");
      return false;
    }
    await api.admin.revalidate({ paths: [...new Set(paths)] });
    return true;
  } catch (error) {
    logger.warn("storefront.revalidate.failed", {
      code: error instanceof ORPCError ? error.code : undefined,
      error: String(error),
    });
    return false;
  }
}
