/**
 * Origin'ы, с которых мобильное приложение (оболочка Capacitor) ходит на сайт.
 *
 * - Android: бандл открывается как `https://localhost` (`androidScheme: "https"`
 *   в `apps/mobile/capacitor.config.ts`);
 * - iOS: `capacitor://localhost`.
 *
 * Список точный, без шаблонов: он же служит белым списком CORS (см. cors.ts).
 * Менять его надо вместе с `capacitor.config.ts` — это проверяет тест в
 * `apps/mobile/src/auth-origins.test.ts`.
 */
export const MOBILE_APP_ORIGINS: readonly string[] = [
  "https://localhost",
  "capacitor://localhost",
];

/**
 * Origin'ы вместе с их www/без-www парами, без дублей. Origin считаем как
 * `протокол//хост`, а не через `URL.origin`: у нестандартных схем
 * (`capacitor://localhost`) он «null».
 */
export function withWwwVariants(urls: readonly string[]): string[] {
  const origins = new Set<string>();
  for (const url of urls) {
    const { protocol, host } = new URL(url);
    origins.add(`${protocol}//${host}`);
    if (host === "localhost" || host.startsWith("localhost:")) continue;
    const twin = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
    origins.add(`${protocol}//${twin}`);
  }
  return [...origins];
}

/**
 * Доверенные origin'ы better-auth: сайт (с www-вариантом) плюс `extra` —
 * например, мобильное приложение. Без пустых и повторяющихся значений.
 */
export function trustedOriginsFor(
  siteUrls: readonly string[],
  extra: readonly string[] = [],
): string[] {
  return [...new Set([...withWwwVariants(siteUrls), ...extra])];
}
