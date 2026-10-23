import { type NextRequest, NextResponse } from "next/server";
import { applyProductOrderPayment } from "@/lib/commerce/order-payment";
import { getOrderById } from "@/lib/payments/orders";
import {
  getInvoice,
  invoicePayment,
  invoiceTarget,
  isRobokassaConfigured,
  markInvoicePaid,
  outSumToKopecks,
  verifyResultSignature,
} from "@/lib/payments/robokassa";
import { applyWorkshopPayment } from "@/lib/workshops/order-payment";

export const runtime = "nodejs";

function text(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** Robokassa шлёт Result URL методом, выбранным в настройках магазина. */
async function readParams(request: NextRequest): Promise<URLSearchParams> {
  if (request.method === "GET") return request.nextUrl.searchParams;
  return new URLSearchParams(await request.text());
}

/**
 * Result URL Robokassa — уведомление об успешной оплате счёта.
 *
 * Безопасность: уведомление подписано паролем №2, который знают только
 * Robokassa и сервер. Сумму сверяем со своим счётом. Ответ «OK<номер>»
 * подтверждает приём; любой другой Robokassa считает неудачей.
 */
async function handle(request: NextRequest) {
  if (!isRobokassaConfigured()) return text("not configured", 503);
  const params = await readParams(request);
  if (!verifyResultSignature(params)) {
    console.warn(
      `[payments/robokassa] Неверная подпись уведомления по счёту ${params.get("InvId")}`,
    );
    return text("bad sign", 400);
  }

  const invoiceId = Number(params.get("InvId"));
  try {
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
      console.error(`[payments/robokassa] Счёт ${invoiceId} не найден`);
      return text("unknown invoice", 404);
    }
    const outSum = outSumToKopecks(params.get("OutSum") ?? "");
    if (outSum !== invoice.amount) {
      console.error(
        `[payments/robokassa] Несовпадение суммы по счёту ${invoiceId}: ожидалось ${invoice.amount}, получено ${params.get("OutSum")}`,
      );
      return text("bad sum", 400);
    }

    const paid = await markInvoicePaid(
      invoiceId,
      params.get("PaymentMethod") ?? params.get("IncCurrLabel"),
    );
    const payment = invoicePayment(paid ?? invoice, "succeeded");
    const target = invoiceTarget(invoice);
    if (target.kind === "product") {
      await applyProductOrderPayment(target.orderId, payment);
    } else {
      const order = await getOrderById(target.orderId);
      if (order) await applyWorkshopPayment(order, payment);
    }

    return text(`OK${invoiceId}`);
  } catch (error) {
    console.error(
      `[payments/robokassa] Ошибка обработки уведомления по счёту ${invoiceId}:`,
      error,
    );
    // Не «OK» — Robokassa сочтёт уведомление недоставленным
    return text("internal", 500);
  }
}

export const GET = handle;
export const POST = handle;
