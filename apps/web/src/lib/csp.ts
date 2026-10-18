/**
 * Content-Security-Policy витрины.
 *
 * Страницы получают политику с nonce из proxy.ts: новый nonce на каждый
 * запрос, Next сам ставит его на свои скрипты, а 'strict-dynamic' пропускает
 * всё, что эти скрипты подгружают (Метрика, пиксель VK, Umami, Яндекс Карты,
 * чанки). Поэтому inline-скрипт без nonce — то есть внедрённый через XSS — не
 * выполнится. Остальные ответы (API, файлы) получают статическую политику без
 * inline-скриптов из next.config.ts.
 * @see node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
 */

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
const metrika = metrikaHosts.map((host) => `https://${host}`);
const metrikaSockets = metrikaHosts.map((host) => `wss://${host}`);

// Яндекс Карты 2.1 (карта пунктов выдачи): модули, тайлы, подсказки адресов,
// пиксель статистики API.
const yandexMaps = [
  "https://api-maps.yandex.ru",
  "https://log.api-maps.yandex.ru",
  "https://suggest-maps.yandex.ru",
  "https://*.maps.yandex.net",
  "https://yandex.ru",
  "https://yastatic.net",
];

// Пиксель VK Рекламы (top-fwz1) и его синхронизация cookie.
const mailRu = ["https://top-fwz1.mail.ru", "https://privacy-cs.mail.ru"];

// Фото каталога, отзывов и пунктов выдачи; сегменты видео уроков.
const storage = [
  "https://cdn.stariva.ru",
  "https://storage.yandexcloud.net",
  "https://*.storage.yandexcloud.net",
];
const ozon = ["https://*.ozon.ru", "https://*.ozone.ru"];

/** Директивы, общие для страниц и прочих ответов. */
function baseDirectives(isDev: boolean): string[] {
  return [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Случайная http-ссылка на картинку или скрипт не уйдёт открытым текстом
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];
}

/** Политика HTML-страниц: скрипты только с nonce этого запроса. */
export function pageContentSecurityPolicy({
  nonce,
  isDev,
}: {
  nonce: string;
  isDev: boolean;
}): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // React в dev восстанавливает серверные стеки ошибок через eval
    ...(isDev ? ["'unsafe-eval'"] : []),
    // Браузеры без 'strict-dynamic' (CSP2) проверяют хосты, новые их игнорируют
    "https://mc.yandex.ru",
    "https://cloud.umami.is",
    ...mailRu,
    ...yandexMaps,
  ];
  return [
    ...baseDirectives(isDev),
    `script-src ${scriptSrc.join(" ")}`,
    `img-src 'self' data: blob: ${[...storage, ...ozon, ...metrika, ...mailRu, "https://ad.mail.ru", ...yandexMaps].join(" ")}`,
    `media-src 'self' blob: ${storage.join(" ")}`,
    // hls.js разбирает видео в воркере из blob:
    "worker-src 'self' blob:",
    `connect-src 'self' ${[...metrika, ...metrikaSockets, "https://gateway.umami.is", ...mailRu, ...yandexMaps, ...storage].join(" ")}`,
    // Вебвизор Метрики открывает свои фреймы
    `frame-src ${metrika.join(" ")}`,
  ].join("; ");
}

/** Политика ответов без nonce (API, файлы): inline-скрипты запрещены. */
export function staticContentSecurityPolicy({
  isDev,
}: {
  isDev: boolean;
}): string {
  return [
    ...baseDirectives(isDev),
    `script-src 'self'${isDev ? " 'unsafe-eval'" : ""}`,
    "img-src 'self' data: https:",
  ].join("; ");
}

/** Случайный nonce, как в документации Next: UUID v4 в base64. */
export function createNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}
