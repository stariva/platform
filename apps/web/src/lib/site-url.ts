/** Public search URLs must never inherit a local development host in production. */
export function resolveSiteUrl(value: string | undefined, production: boolean) {
  if (production || !value) return "https://stariva.ru";
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Site URL must use HTTP or HTTPS");
  }
  return url.origin;
}

export const SITE_URL = resolveSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.NODE_ENV === "production",
);

/**
 * openGraph из leaf-метадаты полностью заменяет родительский (shallow merge),
 * поэтому базовые поля прокидываем на каждой странице через spread первыми.
 */
export const SITE_OPEN_GRAPH = {
  type: "website",
  locale: "ru_RU",
  siteName: "Stariva",
} as const;
