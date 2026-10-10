import type { CampaignAttribution, CampaignTouch } from "@stariva/db/schema";
import { z } from "zod";

/**
 * Источник заказа по UTM-меткам, без Метрики и без идентификатора посетителя.
 *
 * proxy.ts на заходе по ссылке с UTM пишет first-party cookie с первым и
 * последним заходом; обработчики заказов читают её на сервере. Блокировщики
 * (Brave Shields, uBlock, AdGuard) режут сторонние счётчики, но не нашу
 * cookie, а UTM-метки Brave из ссылок не вырезает (в отличие от yclid).
 */
export const ATTRIBUTION_COOKIE = "stariva_src";
export const ATTRIBUTION_MAX_AGE = 90 * 24 * 60 * 60; // секунды
export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const utm = z.string().max(120).optional();
const touchSchema = z.object({
  utm_source: utm,
  utm_medium: utm,
  utm_campaign: utm,
  utm_content: utm,
  utm_term: utm,
  landing: z.string().max(200),
  referrer: z.string().max(100).optional(),
  at: z.iso.datetime(),
}) satisfies z.ZodType<CampaignTouch>;
export const attributionSchema = z.object({
  first: touchSchema,
  last: touchSchema,
}) satisfies z.ZodType<CampaignAttribution>;

/** Заход по ссылке с UTM; без меток — не заход, кампания не перетирается. */
export function touchFromUrl(
  url: URL,
  referer: string | null,
  now = new Date(),
): CampaignTouch | null {
  const touch: CampaignTouch = {
    // Как в analyticsUrl: id заказа в пути — не источник.
    landing: url.pathname
      .replace(/^\/order\/[^/]+/, "/order/status")
      .slice(0, 200),
    at: now.toISOString(),
  };
  let tagged = false;
  for (const key of UTM_KEYS) {
    const value = url.searchParams.get(key)?.trim().slice(0, 120);
    if (value) {
      touch[key] = value;
      tagged = true;
    }
  }
  if (!tagged) return null;
  try {
    const host = referer ? new URL(referer).hostname : "";
    if (host && host !== url.hostname) touch.referrer = host.slice(0, 100);
  } catch {
    /* Битый Referer — просто без него. */
  }
  return touch;
}

/** Сохраняет первый заход и заменяет последний; без истории оба равны новому. */
export function addTouch(
  current: CampaignAttribution | null,
  touch: CampaignTouch,
): CampaignAttribution {
  return { first: current?.first ?? touch, last: touch };
}

/** Значение cookie уже декодировано; всё, что не по схеме, отбрасываем. */
export function parseAttribution(
  value: string | undefined,
): CampaignAttribution | null {
  if (!value) return null;
  try {
    const parsed = attributionSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Для обработчиков заказов: атрибуция из заголовка Cookie запроса. */
export function attributionFromRequest(
  request: Request,
): CampaignAttribution | null {
  for (const part of request.headers.get("cookie")?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== ATTRIBUTION_COOKIE)
      continue;
    try {
      return parseAttribution(
        decodeURIComponent(part.slice(separator + 1).trim()),
      );
    } catch {
      return null;
    }
  }
  return null;
}

/** Для уведомления мастеру: «utm_source=…, utm_campaign=… → /landing (с ya.ru)». */
export function formatTouch(touch: CampaignTouch): string {
  const tags = UTM_KEYS.flatMap((key) =>
    touch[key] ? [`${key}=${touch[key]}`] : [],
  ).join(", ");
  return `${tags} → ${touch.landing}${touch.referrer ? ` (с ${touch.referrer})` : ""}`;
}
