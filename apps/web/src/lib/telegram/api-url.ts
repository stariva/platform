const DEFAULT_TELEGRAM_API = "https://api.telegram.org";

/**
 * Адрес метода Bot API. Если api.telegram.org недоступен с сервера, запросы
 * идут через обратный прокси (TG_API_PROXY_URL), который отдаёт тот же API.
 */
export function telegramApiUrl(
  token: string,
  method: string,
  proxyUrl?: string,
): string {
  const base = (proxyUrl || DEFAULT_TELEGRAM_API).replace(/\/+$/, "");
  return `${base}/bot${token}/${method}`;
}
