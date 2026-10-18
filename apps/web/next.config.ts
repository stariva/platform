import type { NextConfig } from "next";

import "./src/env";
import { staticContentSecurityPolicy } from "./src/lib/csp";

/**
 * Security headers applied to every response. Pages get their nonce-based
 * Content-Security-Policy from `src/proxy.ts`; responses the proxy skips
 * (API, files) get the static policy below.
 * @see https://nextjs.org/docs/app/guides/content-security-policy
 */
const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
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
    return [
      { source: "/:path*", headers: securityHeaders },
      // Страницы получают CSP с nonce в proxy.ts. КП для баз отдыха — HTML со
      // своей политикой, её не перекрываем.
      {
        source: "/api/:path((?!kp/).*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: staticContentSecurityPolicy({ isDev }),
          },
        ],
      },
    ];
  },
};

export default config;
