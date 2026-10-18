import { isIP } from "node:net";
import type { VisitorInfo } from "@stariva/db/schema";
import { z } from "zod";
import { attributionFromRequest } from "./campaign-attribution";

/**
 * Данные о посетителе для заказа, записи на мастер-класс и заявки:
 * IP, город, провайдер, устройство, язык, экран и часовой пояс.
 *
 * Сервер берёт всё из заголовков запроса. То, что видно только браузеру
 * (экран, часовой пояс), приходит в first-party cookie `stariva_env`,
 * которую ставит компонент VisitorEnv. Ничего из этого не зависит от
 * Метрики и блокировщиков, а сбой любого источника не ломает оформление.
 */
export const VISITOR_ENV_COOKIE = "stariva_env";

const str = (max: number) => z.string().max(max).optional();
const envSchema = z.object({
  tz: str(64),
  scr: str(20),
  vp: str(20),
  dpr: z.number().min(0).max(10).optional(),
  lang: str(35),
  langs: str(200),
});

const GEO_LOOKUP_URL =
  "https://suggestions.dadata.ru/suggestions/api/4_1/rs/iplocate/address";
const GEO_LOOKUP_TIMEOUT_MS = 1200;
const GEO_CACHE_LIMIT = 500;
const GEO_MISS_TTL_MS = 5 * 60_000;
/** После сбоя сервиса геокодер не трогаем минуту, чтобы не тормозить заказы. */
const GEO_COOLDOWN_MS = 60_000;

type Geo = Pick<
  VisitorInfo,
  | "country"
  | "countryCode"
  | "region"
  | "city"
  | "postalCode"
  | "latitude"
  | "longitude"
  | "ipTimezone"
  | "isp"
  | "asn"
>;

const geoCache = new Map<string, { geo: Geo | null; expiresAt: number }>();
let geoDownUntil = 0;

function cacheGeo(ip: string, geo: Geo | null, expiresAt = Infinity) {
  if (geoCache.size >= GEO_CACHE_LIMIT) {
    const oldest = geoCache.keys().next().value;
    if (oldest !== undefined) geoCache.delete(oldest);
  }
  geoCache.set(ip, { geo, expiresAt });
}

const clean = (value: string | null | undefined, max = 200) => {
  const text = value
    ?.replace(/\p{Cc}/gu, "")
    .trim()
    .slice(0, max);
  return text || undefined;
};

/** Vercel отдаёт город в percent-encoding, остальные — как есть. */
const decode = (value: string | null | undefined) => {
  if (!value) return undefined;
  try {
    return clean(decodeURIComponent(value));
  } catch {
    return clean(value);
  }
};

const number = (value: string | null | undefined) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * IP клиента. Ingress (Traefik) перезаписывает x-real-ip настоящим адресом;
 * в x-forwarded-for берём первый адрес, это запасной вариант. cf-connecting-ip
 * не читаем: Cloudflare перед сайтом нет, и этот заголовок подставит кто
 * угодно — и подделал бы IP в журнале входов и в заказах.
 */
export function clientIp(headers: Headers): string | null {
  const candidates = [
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const candidate of candidates) {
    const ip = candidate?.trim().replace(/^::ffff:/i, "");
    if (ip && isIP(ip)) return ip;
  }
  return null;
}

/** Локальные и частные адреса: искать по ним город бессмысленно. */
export function isPublicIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a = 0, b = 0] = ip.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const lower = ip.toLowerCase();
  return !(
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80")
  );
}

/** Город и страна из заголовков Cloudflare или Vercel, если они есть. */
export function geoFromHeaders(headers: Headers): Geo | null {
  const countryCode = clean(
    headers.get("cf-ipcountry") ?? headers.get("x-vercel-ip-country"),
    2,
  );
  const city = decode(
    headers.get("cf-ipcity") ?? headers.get("x-vercel-ip-city"),
  );
  if (!city && (!countryCode || countryCode === "XX" || countryCode === "T1"))
    return null;
  return {
    countryCode,
    city,
    region: decode(
      headers.get("cf-region") ?? headers.get("x-vercel-ip-country-region"),
    ),
    postalCode: clean(headers.get("cf-postal-code"), 20),
    latitude: number(
      headers.get("cf-iplatitude") ?? headers.get("x-vercel-ip-latitude"),
    ),
    longitude: number(
      headers.get("cf-iplongitude") ?? headers.get("x-vercel-ip-longitude"),
    ),
    ipTimezone: clean(
      headers.get("cf-timezone") ?? headers.get("x-vercel-ip-timezone"),
      64,
    ),
  };
}

interface LookupResponse {
  location?: {
    data?: {
      country?: string | null;
      country_iso_code?: string | null;
      region_with_type?: string | null;
      city?: string | null;
      postal_code?: string | null;
      geo_lat?: string | null;
      geo_lon?: string | null;
    };
  } | null;
}

/**
 * Город по IP через DaData (российский сервис, данные остаются в РФ).
 * Знает только российские адреса; null при сбое, таймауте, чужом IP или
 * без ключа.
 */
export async function lookupGeo(
  ip: string,
  apiKey: string | undefined,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<Geo | null> {
  if (!apiKey) return null;
  const cached = geoCache.get(ip);
  if (cached && now < cached.expiresAt) return cached.geo;
  if (cached) geoCache.delete(ip);
  if (now < geoDownUntil) return null;
  try {
    const response = await fetcher(
      `${GEO_LOOKUP_URL}?ip=${encodeURIComponent(ip)}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Token ${apiKey}`,
        },
        signal: AbortSignal.timeout(GEO_LOOKUP_TIMEOUT_MS),
      },
    );
    if (!response.ok) throw new Error(`geo lookup ${response.status}`);
    const data = ((await response.json()) as LookupResponse).location?.data;
    // Не нашли город (например, зарубежный IP) — это не сбой сервиса.
    if (!data?.city && !data?.region_with_type) {
      cacheGeo(ip, null, now + GEO_MISS_TTL_MS);
      return null;
    }
    const latitude = Number(data.geo_lat);
    const longitude = Number(data.geo_lon);
    const geo: Geo = {
      country: clean(data.country, 80),
      countryCode: clean(data.country_iso_code, 2),
      region: clean(data.region_with_type, 80),
      city: clean(data.city, 80),
      postalCode: clean(data.postal_code, 20),
      latitude:
        data.geo_lat && Number.isFinite(latitude) ? latitude : undefined,
      longitude:
        data.geo_lon && Number.isFinite(longitude) ? longitude : undefined,
    };
    cacheGeo(ip, geo);
    return geo;
  } catch {
    geoDownUntil = now + GEO_COOLDOWN_MS;
    return null;
  }
}

export function resetGeoState() {
  geoCache.clear();
  geoDownUntil = 0;
}

/** Браузер, ОС и тип устройства из User-Agent: без внешних библиотек. */
export function parseUserAgent(
  userAgent: string,
): Pick<VisitorInfo, "browser" | "os" | "device" | "deviceModel"> {
  let browser: string | undefined;
  const checks: Array<[string, RegExp]> = [
    ["Yandex Browser", /YaBrowser\/([\d.]+)/],
    ["Edge", /Edg(?:e|A|iOS)?\/([\d.]+)/],
    ["Opera", /(?:OPR|OPiOS)\/([\d.]+)/],
    ["Samsung Internet", /SamsungBrowser\/([\d.]+)/],
    ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/],
    ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/],
    ["Safari", /Version\/([\d.]+).*Safari/],
  ];
  for (const [name, pattern] of checks) {
    const found = pattern.exec(userAgent)?.[1];
    if (found) {
      browser = `${name} ${found.split(".")[0]}`;
      break;
    }
  }

  let os: string | undefined;
  const android = /Android ([\d.]+)/.exec(userAgent)?.[1];
  const ios = /(?:iPhone|iPad|iPod).*? OS ([\d_]+)/.exec(userAgent)?.[1];
  if (/Windows NT 10/.test(userAgent)) os = "Windows 10/11";
  else if (/Windows/.test(userAgent)) os = "Windows";
  else if (android) os = `Android ${android}`;
  else if (ios) os = `iOS ${ios.replaceAll("_", ".")}`;
  else if (/Mac OS X/.test(userAgent)) os = "macOS";
  else if (/CrOS/.test(userAgent)) os = "ChromeOS";
  else if (/Linux/.test(userAgent)) os = "Linux";

  let device: VisitorInfo["device"] = "desktop";
  if (/bot|crawler|spider|headless|curl|python-requests/i.test(userAgent))
    device = "bot";
  else if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent))
    device = "tablet";
  else if (/Mobi|iPhone|iPod|Android/i.test(userAgent)) device = "mobile";

  let deviceModel: string | undefined;
  if (/iPhone/.test(userAgent)) deviceModel = "iPhone";
  else if (/iPad/.test(userAgent)) deviceModel = "iPad";
  else
    deviceModel = clean(
      /Android [\d.]+; ([^;)]+?)(?: Build|\))/.exec(userAgent)?.[1],
      60,
    );

  return { browser, os, device, deviceModel };
}

/** Читает cookie `stariva_env` из заголовка Cookie; битую молча отбрасывает. */
export function envFromCookie(cookieHeader: string | null) {
  for (const part of cookieHeader?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== VISITOR_ENV_COOKIE)
      continue;
    try {
      const parsed = envSchema.safeParse(
        JSON.parse(decodeURIComponent(part.slice(separator + 1).trim())),
      );
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Путь страницы, с которой отправлена форма (без query и хэша). */
function pageOf(request: Pick<Request, "headers">): string | undefined {
  const referer = request.headers.get("referer");
  if (!referer) return undefined;
  try {
    const { pathname } = new URL(referer);
    return clean(pathname.replace(/^\/order\/[^/]+/, "/order/status"), 200);
  } catch {
    return undefined;
  }
}

async function defaultLookup(ip: string) {
  // Лениво: env проверяет все переменные сайта, тестам он не нужен.
  const { env } = await import("@/env");
  return lookupGeo(ip, env.DADATA_API_KEY);
}

/**
 * Собирает всё, что известно о посетителе. Не бросает исключений: заказ
 * важнее статистики, поэтому в худшем случае вернётся хотя бы время.
 */
export async function collectVisitor(
  request: Pick<Request, "headers">,
  options: { lookup?: (ip: string) => Promise<Geo | null> } = {},
): Promise<VisitorInfo> {
  const at = new Date().toISOString();
  try {
    const headers = request.headers;
    const ip = clientIp(headers);
    let geo = geoFromHeaders(headers);
    let geoSource: VisitorInfo["geoSource"] = geo ? "headers" : undefined;
    // Заголовки CDN дают город без провайдера; ищем по IP, пока нет города.
    if (!geo?.city && ip && isPublicIp(ip)) {
      const found = await (options.lookup ?? defaultLookup)(ip).catch(
        () => null,
      );
      if (found) {
        geo = { ...geo, ...found };
        geoSource = "lookup";
      }
    }
    const userAgent = clean(headers.get("user-agent"), 400);
    const env = envFromCookie(headers.get("cookie"));
    const languages = clean(headers.get("accept-language"), 120);
    // Источник последнего сохранённого захода, переданный в cookie при оформлении.
    const referrer = clean(attributionFromRequest(request)?.last.referrer, 100);
    const visitor: VisitorInfo = {
      ip,
      geoSource,
      ...geo,
      ...(userAgent ? { userAgent, ...parseUserAgent(userAgent) } : {}),
      timezone: env?.tz,
      language: env?.lang ?? languages?.split(",")[0]?.split(";")[0]?.trim(),
      languages: env?.langs ?? languages,
      screen: env?.scr,
      viewport: env?.vp,
      pixelRatio: env?.dpr,
      referrer,
      page: pageOf(request),
      at,
    };
    // Пустые поля в jsonb не нужны.
    return Object.fromEntries(
      Object.entries(visitor).filter(([, value]) => value !== undefined),
    ) as unknown as VisitorInfo;
  } catch {
    return { ip: null, at };
  }
}

/** Строки для Telegram и почты мастеру: IP, город, провайдер, устройство. */
export function formatVisitor(visitor: VisitorInfo): string[] {
  const place = [
    visitor.city,
    visitor.region,
    visitor.country ?? visitor.countryCode,
  ]
    .filter((part, index, all) => part && all.indexOf(part) === index)
    .join(", ");
  const device = [visitor.deviceModel, visitor.os, visitor.browser]
    .filter(Boolean)
    .join(", ");
  return [
    visitor.ip && `IP: ${visitor.ip}`,
    place && `Город: ${place}`,
    visitor.isp &&
      `Провайдер: ${visitor.isp}${visitor.asn ? ` (${visitor.asn})` : ""}`,
    device &&
      `Устройство: ${device}${visitor.device ? ` (${visitor.device})` : ""}`,
    visitor.language && `Язык: ${visitor.language}`,
    visitor.timezone && `Часовой пояс браузера: ${visitor.timezone}`,
    visitor.screen && `Экран: ${visitor.screen}`,
  ].filter((line): line is string => Boolean(line));
}
