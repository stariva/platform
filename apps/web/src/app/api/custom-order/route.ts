import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { baseEnv, env } from "@/env";
import { describeSelection, formatRub } from "@/lib/custom-order/pricing";

export const runtime = "nodejs";

const fieldsSchema = z.object({
  name: z.string().min(1, "Укажите имя").max(120),
  contact: z.string().min(3, "Укажите контакт для связи").max(200),
  description: z.string().min(5, "Опишите, что хотите").max(3000),
  productType: z.string().max(60).optional(),
  size: z.string().max(60).optional(),
  color: z.string().max(60).optional(),
  complexity: z.string().max(60).optional(),
  budget: z.string().max(100).optional(),
  estimateMin: z.coerce.number().optional(),
  estimateMax: z.coerce.number().optional(),
});

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 МБ — лимит Telegram sendPhoto

function buildMessage(
  data: z.infer<typeof fieldsSchema>,
  hasPhoto: boolean,
): string {
  const selection = describeSelection({
    productType: data.productType,
    size: data.size,
    color: data.color,
    complexity: data.complexity,
  });

  const lines = [
    "🧶 <b>Новая заявка на индивидуальный заказ</b>",
    "",
    `<b>Имя:</b> ${escapeHtml(data.name)}`,
    `<b>Контакт:</b> ${escapeHtml(data.contact)}`,
    selection ? `<b>Параметры:</b> ${escapeHtml(selection)}` : "",
    data.budget ? `<b>Бюджет:</b> ${escapeHtml(data.budget)}` : "",
    data.estimateMin && data.estimateMax
      ? `<b>Расчёт калькулятора:</b> ${formatRub(data.estimateMin)}–${formatRub(data.estimateMax)}`
      : "",
    "",
    "<b>Описание:</b>",
    escapeHtml(data.description),
    hasPhoto ? "" : "",
  ];

  return lines.filter((l) => l !== "").join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendToTelegram(
  message: string,
  photo: File | null,
): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error("telegram_not_configured");
  }

  if (photo) {
    // Фото + подпись (Telegram ограничивает caption 1024 символами)
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("parse_mode", "HTML");
    form.append("caption", message.slice(0, 1024));
    form.append("photo", photo, photo.name || "inspiration.jpg");

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      throw new Error(`telegram_photo_failed_${res.status}`);
    }

    // Если описание длиннее лимита подписи — досылаем полный текст
    if (message.length > 1024) {
      await sendTelegramMessage(token, chatId, message);
    }
    return;
  }

  await sendTelegramMessage(token, chatId, message);
}

async function sendTelegramMessage(
  token: string,
  chatId: string,
  message: string,
): Promise<void> {
  // Telegram лимит — 4096 символов
  const truncated =
    message.length > 4096
      ? `${message.slice(0, 4090)}\n...(обрезано)`
      : message;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId.trim(),
      text: truncated,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "unknown");
    throw new Error(`telegram_message_failed_${res.status}: ${body}`);
  }
}

async function sendEmail(message: string): Promise<void> {
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
      subject: "Новая заявка на индивидуальный заказ — Stariva",
      html: message.replace(/\n/g, "<br>"),
    }),
  });
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const raw = Object.fromEntries(
    [
      "name",
      "contact",
      "description",
      "productType",
      "size",
      "color",
      "complexity",
      "budget",
      "estimateMin",
      "estimateMax",
    ].map((key) => [key, formData.get(key) ?? undefined]),
  );

  const parsed = fieldsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Проверьте поля формы" },
      { status: 400 },
    );
  }

  const photoEntry = formData.get("photo");
  let photo: File | null = null;
  if (photoEntry instanceof File && photoEntry.size > 0) {
    if (photoEntry.size > MAX_PHOTO_BYTES) {
      return NextResponse.json(
        { error: "Фото слишком большое (максимум 8 МБ)" },
        { status: 400 },
      );
    }
    if (!photoEntry.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Прикрепите изображение" },
        { status: 400 },
      );
    }
    photo = photoEntry;
  }

  const message = buildMessage(parsed.data, Boolean(photo));

  const telegramConfigured = Boolean(
    env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID,
  );

  // Telegram — отдельный try, чтобы его ошибки не блокировали email
  const telegramPromise = telegramConfigured
    ? sendToTelegram(message, photo).catch((err) => {
        console.error("[custom-order] Ошибка Telegram:", err);
      })
    : Promise.resolve();

  // Email отправляем синхронно, ждём его результата
  const emailPromise = sendEmail(message).catch((err) => {
    console.error("[custom-order] Ошибка email:", err);
  });

  await Promise.all([telegramPromise, emailPromise]);

  if (!telegramConfigured && !baseEnv.RESEND_API_KEY) {
    // Ни один канал не настроен
    if (baseEnv.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Приём заявок временно недоступен" },
        { status: 503 },
      );
    }
    console.warn(
      "[custom-order] Каналы доставки не настроены. Заявка:\n",
      message,
    );
  }

  return NextResponse.json({ ok: true });
}
