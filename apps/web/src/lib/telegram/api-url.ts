/** Адрес метода Telegram Bot API. */
export function telegramApiUrl(token: string, method: string): string {
  return `https://api.telegram.org/bot${token}/${method}`;
}
