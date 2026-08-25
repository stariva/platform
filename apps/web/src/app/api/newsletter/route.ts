import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { baseEnv, env } from "@/env";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email("Укажите корректный email").max(200),
  // Откуда пришла подписка — блог, футер, поп-ап и т.д.
  source: z.string().max(60).optional(),
});

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
  ].filter((l) => l !== "");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: lines.join("\n"),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
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

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Проверьте email" },
      { status: 400 },
    );
  }

  const { email, source } = parsed.data;

  try {
    await sendToTelegram(email, source);
    // email-дубль отправляем «вдогонку», не блокируя ответ клиенту
    void sendEmailNotification(email, source);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[newsletter] Ошибка подписки:", error);
    return NextResponse.json(
      { error: "Не удалось оформить подписку. Попробуйте позже." },
      { status: 502 },
    );
  }
}
