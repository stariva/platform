import { baseEnv, env } from "@/env";
import { LEGAL_VERSION } from "@/lib/legal";
import { telegramApiUrl } from "@/lib/telegram/api-url";

/**
 * Уведомление мастеру о новой подписке на рассылку. Telegram обязателен:
 * без него подписка не засчитывается. Письмо — необязательный дубль, его
 * отправляем «вдогонку», не дожидаясь.
 */
export async function subscribeToNewsletter(
  email: string,
  source?: string,
): Promise<void> {
  await sendToTelegram(email, source);
  void sendEmailNotification(email, source);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendToTelegram(email: string, source?: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error("telegram_not_configured");
  }

  const lines = [
    "📬 <b>Новая подписка на рассылку</b>",
    "",
    `<b>Email:</b> ${escapeHtml(email)}`,
    source ? `<b>Источник:</b> ${escapeHtml(source)}` : "",
    `<i>Согласия на обработку ПДн и рассылку получены, редакция ${LEGAL_VERSION}, ${new Date().toISOString()}</i>`,
  ].filter((l) => l !== "");

  const res = await fetch(
    telegramApiUrl(token, "sendMessage", env.TG_API_PROXY_URL),
    {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: lines.join("\n"),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
    },
  );
  if (!res.ok) {
    throw new Error(`telegram_message_failed_${res.status}`);
  }
}

async function sendEmailNotification(
  email: string,
  source?: string,
): Promise<void> {
  const apiKey = baseEnv.RESEND_API_KEY;
  const to = env.ORDER_EMAIL_TO;
  const from = env.ORDER_EMAIL_FROM;
  if (!apiKey || !to || !from) return; // email — необязательный канал

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Новая подписка на рассылку — Stariva",
      html: `Новый подписчик: <b>${escapeHtml(email)}</b>${
        source ? `<br>Источник: ${escapeHtml(source)}` : ""
      }`,
    }),
  }).catch(() => {
    // email — необязательный канал, ошибку не эскалируем
  });
}
