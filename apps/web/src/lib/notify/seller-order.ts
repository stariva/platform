import { baseEnv, env } from "@/env";
import { formatPrice } from "@/lib/products";

export interface SellerOrderNotification {
  orderId: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  amountTotal: number;
  items: { name: string; quantity: number; price: number }[];
  confirmUrl: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildMessage(data: SellerOrderNotification): string {
  const lines = [
    "🧾 <b>Новый заказ без online-оплаты</b>",
    "",
    `<b>Заказ:</b> №${data.orderId.slice(0, 8)}`,
    `<b>Имя:</b> ${escapeHtml(data.contactName)}`,
    `<b>Телефон:</b> ${escapeHtml(data.contactPhone)}`,
    data.contactEmail ? `<b>Email:</b> ${escapeHtml(data.contactEmail)}` : "",
    "",
    "<b>Состав:</b>",
    ...data.items.map(
      (i) => `— ${escapeHtml(i.name)} × ${i.quantity} (${formatPrice((i.price * i.quantity) / 100)})`,
    ),
    "",
    `<b>Итого к оплате:</b> ${formatPrice(data.amountTotal / 100)}`,
    "",
    "Пришлите покупателю ссылку на оплату (СБП/реквизиты) сами. Как только деньги получены — подтвердите оплату:",
    data.confirmUrl,
  ];
  return lines.filter((l) => l !== "").join("\n");
}

async function sendTelegramMessage(message: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

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

async function sendOrderEmail(orderId: string, message: string): Promise<void> {
  const apiKey = baseEnv.RESEND_API_KEY;
  const to = env.ORDER_EMAIL_TO;
  const from = env.ORDER_EMAIL_FROM;
  if (!apiKey || !to || !from) return; // email — необязательный канал

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `Новый заказ №${orderId.slice(0, 8)} без online-оплаты — Stariva`,
      html: message.replace(/\n/g, "<br>"),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "unknown");
    throw new Error(`order_email_failed_${res.status}: ${body}`);
  }
}

/**
 * Уведомляет продавца о заказе с paymentMethod === "seller_link": он должен
 * сам прислать покупателю ссылку на оплату и потом подтвердить её по ссылке
 * из этого уведомления. Ошибки каналов не блокируют оформление заказа.
 */
export async function notifySellerAboutManualOrder(
  data: SellerOrderNotification,
): Promise<void> {
  const message = buildMessage(data);

  const results = await Promise.allSettled([
    sendTelegramMessage(message),
    sendOrderEmail(data.orderId, message),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error(
        "[notify/seller-order] Не удалось отправить уведомление:",
        result.reason,
      );
    }
  }
}
