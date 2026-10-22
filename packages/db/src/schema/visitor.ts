/**
 * Что сервер знает о посетителе в момент заказа, записи или заявки.
 * Всё берётся из заголовков запроса и first-party cookie `stariva_env`,
 * поэтому не зависит от Метрики и блокировщиков.
 */
export interface VisitorInfo {
  ip: string | null;
  // Откуда определён город: заголовок CDN/прокси или запрос по IP.
  geoSource?: "headers" | "lookup";
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  // Часовой пояс по IP (сервер) и из браузера (клиент): расхождение — признак VPN.
  ipTimezone?: string;
  timezone?: string;
  // Провайдер и сеть: мобильная, домашняя, хостинг/VPN.
  isp?: string;
  asn?: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  device?: "mobile" | "tablet" | "desktop" | "bot";
  deviceModel?: string;
  language?: string;
  languages?: string;
  screen?: string;
  viewport?: string;
  pixelRatio?: number;
  referrer?: string;
  page?: string;
  // ClientID Метрики из её cookie _ym_uid: по нему заказ можно потом
  // сопоставить с визитами. Есть, только если посетитель согласился на аналитику.
  ymClientId?: string;
  at: string; // ISO 8601
}
