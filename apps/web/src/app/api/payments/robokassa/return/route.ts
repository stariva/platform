import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { siteUrl } from "@/lib/commerce/order-services";
import { getOrderById } from "@/lib/payments/orders";
import { getInvoice, invoiceTarget } from "@/lib/payments/robokassa";

export const runtime = "nodejs";

/**
 * Номер счёта приходит в адресе без подписи, поэтому проверяем его форму до
 * запроса: целое в диапазоне integer нашей таблицы.
 */
const returnParamsSchema = z
  .object({
    InvId: z.coerce.number().int().min(1).max(2_147_483_647),
  })
  .passthrough();

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
  const parsed = returnParamsSchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) return NextResponse.redirect(`${base}/`, 303);

  const invoice = await getInvoice(parsed.data.InvId).catch(() => null);
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
