import type { NextConfig } from "next";

import "./src/env";

/**
 * Security headers applied to every response.
 *
 * The Content-Security-Policy is a pragmatic baseline that works with the
 * Next.js App Router and Vercel Analytics out of the box. For the strictest
 * setup, switch to a nonce-based CSP in `proxy.ts` and drop `'unsafe-inline'`.
 * @see https://nextjs.org/docs/app/guides/content-security-policy
 */
const isDev = process.env.NODE_ENV === "development";

// Метрика ходит на региональный домен по геолокации посетителя
// (mc.yandex.md из Молдовы, mc.yandex.kz из Казахстана и т.д.).
const metrikaHosts = [
  "mc.yandex.ru",
  "mc.yandex.az",
  "mc.yandex.by",
  "mc.yandex.co.il",
  "mc.yandex.com",
  "mc.yandex.com.am",
  "mc.yandex.com.ge",
  "mc.yandex.com.tr",
  "mc.yandex.ee",
  "mc.yandex.fr",
  "mc.yandex.kg",
  "mc.yandex.kz",
  "mc.yandex.lt",
  "mc.yandex.lv",
  "mc.yandex.md",
  "mc.yandex.tj",
  "mc.yandex.tm",
  "mc.yandex.uz",
  "mc.webvisor.com",
  "mc.webvisor.org",
];
const metrikaFrames = metrikaHosts.map((host) => `https://${host}`).join(" ");
const metrikaSockets = metrikaHosts.map((host) => `wss://${host}`).join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com https://mc.yandex.ru https://top-fwz1.mail.ru https://privacy-cs.mail.ru https://cloud.umami.is https://api-maps.yandex.ru https://yastatic.net https://core-renderer-tiles.maps.yandex.net`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https://storage.yandexcloud.net",
  // hls.js разбирает видео в воркере из blob:
  "worker-src 'self' blob:",
  `connect-src 'self' https: ${metrikaSockets}`,
  `frame-src ${metrikaFrames}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Случайная http-ссылка на картинку или скрипт не уйдёт открытым текстом
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
]
  .join("; ")
  .concat(";");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Геолокация — только самому сайту: кнопка «Моё местоположение» при
    // выборе пункта выдачи. Чужим фреймам (Метрика) — ничего.
    value:
      "camera=(), microphone=(), geolocation=(self), payment=(), usb=(), browsing-topics=()",
  },
  // Открытые нами вкладки (оплата, Telegram) не получают доступ к window сайта
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const config: NextConfig = {
  output: "standalone",
  // Не сообщаем сканерам, на чём собран сайт
  poweredByHeader: false,
  transpilePackages: [
    "@stariva/auth",
    "@stariva/config",
    "@stariva/db",
    "@stariva/emails",
    "@stariva/storage",
    "@stariva/validators",
    "@stariva/web-api",
    "@t3-oss/env-nextjs",
    "@t3-oss/env-core",
  ],
  images: {
    // `quality` props are snapped to this list, so anything not listed
    // silently falls back to 75. 90 is used by the about hero and the
    // product gallery.
    qualities: [75, 90],
    remotePatterns: [
      // Ozon CDN domains for product images
      { protocol: "https", hostname: "cdn1.ozon.ru" },
      { protocol: "https", hostname: "cdn2.ozon.ru" },
      { protocol: "https", hostname: "cdn3.ozon.ru" },
      { protocol: "https", hostname: "cdn1.ozone.ru" },
      { protocol: "https", hostname: "cdn2.ozone.ru" },
      { protocol: "https", hostname: "cdn3.ozone.ru" },
      { protocol: "https", hostname: "ir.ozone.ru" },
      { protocol: "https", hostname: "s3.ozone.ru" },
      // Наш публичный бакет с фото каталога (Yandex Object Storage)
      { protocol: "https", hostname: "storage.yandexcloud.net" },
      { protocol: "https", hostname: "*.storage.yandexcloud.net" },
      // CDN перед публичным бакетом (Yandex Cloud CDN)
      { protocol: "https", hostname: "cdn.stariva.ru" },
    ],
  },
  async redirects() {
    return [
      // Вместо встроенного редиректа, выключенного skipTrailingSlashRedirect:
      // /about/ → /about для всех страниц, кроме прокси PostHog.
      {
        source: "/:path((?!ingest/).+)/",
        destination: "/:path",
        permanent: true,
      },
      {
        source: "/catalog/decor",
        destination: "/catalog/interior",
        permanent: true,
      },
      {
        source: "/catalog/decor/:slug*",
        destination: "/catalog/interior/:slug*",
        permanent: true,
      },
      // Регистрация и вход по ссылке теперь на /sign-in: вход по коду из
      // письма. Параметры (callbackURL, error) переносятся сами.
      { source: "/sign-up", destination: "/sign-in", permanent: false },
      { source: "/magic-link", destination: "/sign-in", permanent: false },
      // Адреса старого сайта и снятых страниц, которые Google ещё обходит
      { source: "/privacy", destination: "/privacy-policy", permanent: true },
      { source: "/terms", destination: "/offer", permanent: true },
      {
        source: "/blog/boho-stil-v-dome",
        destination: "/blog",
        permanent: true,
      },
      {
        source:
          "/workshops/:slug(tipi-kids|dome-lampshade-beginner|placemat-set)",
        destination: "/workshops",
        permanent: true,
      },
      // Blogger collaboration links. Not permanent: campaigns end and slugs get reused.
      {
        source: "/chrisfleur",
        destination:
          "/catalog/clothes?utm_source=chrisfleur&utm_medium=social&utm_campaign=blogger_chrisfleur",
        permanent: false,
      },
    ];
  },
  // PostHog через свой домен: блокировщики режут *.posthog.com, а /ingest — нет.
  // SDK собран с расширениями внутри (posthog-js/full/no-external), поэтому
  // ассеты нужны только для запасных путей: тулбара и старых закэшированных чанков.
  async rewrites() {
    return [
      // Фото главной переехали на CDN, а закэшированные страницы и боты ещё
      // просят старые локальные адреса, в том числе через /_next/image.
      // Не редирект: оптимизатор по 308 не идёт и отвечает ошибкой, а на
      // /_next/image редиректы не действуют.
      {
        source: "/images/home/:file",
        destination: "https://cdn.stariva.ru/site/images/home/:file",
      },
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://eu-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  // API PostHog ждёт адреса со слешем на конце (/e/, /flags/); без этого Next
  // ответил бы 308 на /ingest/e/ и сломал отправку. Редирект для остальных
  // страниц — в redirects() выше.
  skipTrailingSlashRedirect: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
