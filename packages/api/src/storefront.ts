import { env, logger } from "@stariva/config";

/**
 * Просит витрину (stariva.ru) сбросить кэш страниц после правок каталога.
 * Без настроек или при сбое — только предупреждение: страницы товаров всё
 * равно обновятся сами в течение часа.
 */
export async function revalidateStorefront(paths: string[]): Promise<boolean> {
  const baseUrl = env.STOREFRONT_URL;
  const secret = env.REVALIDATE_SECRET;
  if (!baseUrl || !secret) {
    logger.warn("storefront.revalidate.not_configured");
    return false;
  }

  try {
    const res = await fetch(new URL("/api/revalidate", baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paths: [...new Set(paths)] }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      logger.warn("storefront.revalidate.failed", { status: res.status });
    }
    return res.ok;
  } catch (error) {
    logger.warn("storefront.revalidate.error", { error: String(error) });
    return false;
  }
}
