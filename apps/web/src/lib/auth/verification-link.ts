/**
 * Ссылка better-auth подтверждает email сразу при открытии (GET). Почтовые
 * сканеры открывают ссылки из писем сами и так «подтверждали» ботов. Поэтому в
 * письмо кладём ссылку на страницу сайта с кнопкой: подтверждение происходит
 * только по нажатию. Остальные ссылки возвращаются как есть.
 */
export function verificationPageUrl(apiUrl: string): string {
  const url = new URL(apiUrl);
  const token = url.searchParams.get("token");
  if (!token) return apiUrl;

  const page = new URL("/verify-email", url.origin);
  page.searchParams.set("token", token);
  const callbackURL = url.searchParams.get("callbackURL");
  if (callbackURL) page.searchParams.set("callbackURL", callbackURL);
  return page.toString();
}

/** Обратный путь после подтверждения: только внутри сайта. */
export function safeCallbackPath(value: string | null): string {
  if (!value) return "/account";
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/account";
  }
  return value;
}
