import { type NextRequest, NextResponse } from "next/server";
import { fulfillPaidProductOrder } from "@/lib/commerce/fulfillment";
import { confirmProductOrderPaymentByToken } from "@/lib/commerce/orders";

export const runtime = "nodejs";

function htmlResponse(status: number, title: string, body: string) {
  return new NextResponse(
    `<!doctype html><html lang="ru"><meta charset="utf-8"><title>${title}</title>` +
      `<body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center">` +
      `<h1>${title}</h1><p>${body}</p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

/**
 * Показывает страницу с кнопкой подтверждения. Само подтверждение — на POST:
 * почтовые сканеры (Gmail/Outlook Safe Links) сами открывают ссылки из писем,
 * и если бы оплата подтверждалась уже по GET, заказ мог бы «оплатиться» раньше,
 * чем продавец реально получил деньги от покупателя.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return htmlResponse(400, "Не удалось подтвердить оплату", "Отсутствует токен ссылки.");
  }

  return new NextResponse(
    `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Подтверждение оплаты</title>` +
      `<body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center">` +
      `<h1>Подтвердить оплату заказа №${orderId.slice(0, 8)}?</h1>` +
      `<p>Нажмите кнопку только после того, как покупатель реально перевёл деньги.</p>` +
      `<form method="POST"><input type="hidden" name="token" value="${token}">` +
      `<button type="submit" style="padding:12px 24px;font-size:16px;cursor:pointer">Подтвердить оплату</button></form>` +
      `</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const form = await request.formData().catch(() => null);
  const token = form?.get("token");
  if (typeof token !== "string" || !token) {
    return htmlResponse(400, "Не удалось подтвердить оплату", "Отсутствует токен ссылки.");
  }

  const confirmed = await confirmProductOrderPaymentByToken(orderId, token);
  if (!confirmed) {
    return htmlResponse(
      404,
      "Не удалось подтвердить оплату",
      "Заказ не найден, уже отменён или ссылка недействительна.",
    );
  }

  try {
    await fulfillPaidProductOrder(orderId);
  } catch (error) {
    console.error(
      `[orders/confirm-payment] Заказ ${orderId} оплачен, но отправление в Ozon Доставка не создалось:`,
      error,
    );
    return htmlResponse(
      200,
      "Оплата подтверждена",
      `Заказ №${orderId.slice(0, 8)} помечен оплаченным, но отправление в Ozon Доставка не создалось автоматически — потребуется ручная обработка.`,
    );
  }

  return htmlResponse(
    200,
    "Оплата подтверждена",
    `Заказ №${orderId.slice(0, 8)} оплачен и передан в сборку.`,
  );
}
