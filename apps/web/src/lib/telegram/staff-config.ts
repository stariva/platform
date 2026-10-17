import { env } from "@/env";
import { telegramFetch } from "./fetch";

/** Параметры Telegram-бота мастера для deliverNotification. */
export function telegramStaffConfig() {
  return {
    telegramToken: env.TELEGRAM_BOT_TOKEN,
    telegramChatId: env.TELEGRAM_CHAT_ID,
    telegramFetch: telegramFetch(env.TELEGRAM_PROXY_URL),
    // Через прокси ответ бывает медленным
    telegramTimeoutMs: env.TELEGRAM_PROXY_URL ? 30_000 : undefined,
  };
}
