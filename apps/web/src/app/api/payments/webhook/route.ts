import { type NextRequest, NextResponse } from "next/server";
import { grantAccess } from "@/lib/account/access";
import {
  getOrderById,
  markOrderCanceled,
  markOrderPaid,
} from "@/lib/payments/orders";
import { getPayment } from "@/lib/payments/yookassa";

export const runtime = "nodejs";

/**
 * Вебхук YooKassa.
 *
 * Безопасность: тело уведомления не считается доверенным. Мы берём из него
 * только id платежа, после чего запрашиваем актуальный статус напрямую в API
 * YooKassa и сверяем сумму с заказом. Доступ выдаётся идемпотентно.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const paymentId: unknown = body?.object?.id;
  const event: unknown = body?.event;

  if (typeof paymentId !== "string") {
    // Невалидное уведомление — отвечаем 200, чтобы YooKassa не повторяла бесконечно
    return NextResponse.json({ ok: true });
  }

  try {
    // Проверяем подлинность: запрашиваем платёж напрямую у YooKassa
    const payment = await getPayment(paymentId);

    const orderId = payment.metadata?.orderId;
    if (!orderId) {
      return NextResponse.json({ ok: true });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ ok: true });
    }

    // Обработка отмены платежа
    if (payment.status === "canceled" || event === "payment.canceled") {
      await markOrderCanceled(orderId);
      return NextResponse.json({ ok: true });
    }

    // Подтверждаем только успешные оплаченные платежи
    if (payment.status !== "succeeded" || !payment.paid) {
      return NextResponse.json({ ok: true });
    }

    // Сверяем сумму платежа с суммой заказа (защита от подмены)
    const expectedValue = (order.amount / 100).toFixed(2);
    if (payment.amount.value !== expectedValue) {
      console.error(
        `[payments/webhook] Несовпадение суммы для заказа ${orderId}: ожидалось ${expectedValue}, получено ${payment.amount.value}`,
      );
      return NextResponse.json({ ok: true });
    }

    // Идемпотентно: markOrderPaid обновит только pending-заказ
    const wasUpdated = await markOrderPaid(orderId);
    // Доступ выдаём в любом случае (grantAccess идемпотентен) — на случай,
    // если заказ уже был помечен оплаченным, а доступ не записался
    await grantAccess(order.userId, order.workshopSlug, orderId);

    if (wasUpdated) {
      console.info(
        `[payments/webhook] Заказ ${orderId} оплачен, доступ к «${order.workshopSlug}» выдан`,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[payments/webhook] Ошибка обработки уведомления:", error);
    // 500 — YooKassa повторит доставку позже
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
