import { env } from "@/env";

/**
 * Клиентский бот: пишет покупателям, которые сами нажали «Напоминать в
 * Telegram». Мастеру пишет другой бот (TELEGRAM_BOT_TOKEN).
 */
export function isClientBotConfigured(): boolean {
  return Boolean(
    env.TELEGRAM_CLIENT_BOT_TOKEN && env.TELEGRAM_CLIENT_BOT_USERNAME,
  );
}

/** t.me-ссылка, по которой покупатель подписывается на напоминания. */
export function clientBotStartUrl(startToken: string): string | undefined {
  const username = env.TELEGRAM_CLIENT_BOT_USERNAME?.replace(/^@/, "");
  if (!env.TELEGRAM_CLIENT_BOT_TOKEN || !username) return undefined;
  return `https://t.me/${username}?start=${startToken}`;
}

export const escapeTelegramHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Сообщение в чат покупателя (HTML-разметка Telegram). Кнопка-ссылка —
 * только на https-адрес: Telegram отклоняет кнопки на http://localhost.
 */
export async function sendClientMessage(
  chatId: string,
  html: string,
  button?: { text: string; url: string },
): Promise<void> {
  const token = env.TELEGRAM_CLIENT_BOT_TOKEN;
  if (!token) throw new Error("telegram_client_bot_not_configured");

  const withButton = button?.url.startsWith("https://");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: html,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(withButton
        ? {
            reply_markup: {
              inline_keyboard: [[{ text: button?.text, url: button?.url }]],
            },
          }
        : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`telegram_send_failed_${res.status}: ${detail}`);
  }
}
