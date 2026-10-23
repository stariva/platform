import { type NextRequest, NextResponse } from "next/server";
import { siteUrl } from "@/lib/commerce/order-services";
import { getOrderById } from "@/lib/payments/orders";
import { getInvoice, invoiceTarget } from "@/lib/payments/robokassa";

export const runtime = "nodejs";

/**
 * Success URL и Fail URL Robokassa: покупатель вернулся с оплаты. Адреса в
 * настройках магазина общие на все заказы, поэтому по номеру счёта ведём на
 * страницу его заказа — она сама спросит статус и покажет, прошла ли оплата.
 * Подпись не проверяем: здесь ничего не меняется, а страницу заказа
 * открывает только тот браузер или телефон, что его оформил.
 */
async function handle(request: NextRequest) {
  const base = siteUrl(request.headers);
  const params =
    request.method === "GET"
      ? request.nextUrl.searchParams
      : new URLSearchParams(await request.text());
  const invoiceId = Number(params.get("InvId"));
  const invoice = Number.isSafeInteger(invoiceId)
    ? await getInvoice(invoiceId).catch(() => null)
    : null;
  if (!invoice) return NextResponse.redirect(`${base}/`, 303);

  const target = invoiceTarget(invoice);
  if (target.kind === "product") {
    return NextResponse.redirect(
      `${base}/order/${target.orderId}?payment=success`,
      303,
    );
  }
  const order = await getOrderById(target.orderId);
  if (!order) return NextResponse.redirect(`${base}/`, 303);
  return NextResponse.redirect(
    `${base}/workshops/${order.workshopSlug}/booked?order=${order.id}`,
    303,
  );
}

export const GET = handle;
export const POST = handle;
