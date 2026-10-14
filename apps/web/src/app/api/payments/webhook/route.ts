import { type NextRequest, NextResponse } from "next/server";
import { applyProductOrderPayment } from "@/lib/commerce/order-payment";
import { getOrderById } from "@/lib/payments/orders";
import { getPayment } from "@/lib/payments/yookassa";
import { applyWorkshopPayment } from "@/lib/workshops/order-payment";

export const runtime = "nodejs";

/**
 * Вебхук YooKassa.
 *
 * Безопасность: тело уведомления не считается доверенным. Мы берём из него
 * только id платежа, после чего запрашиваем актуальный статус напрямую в API
 * YooKassa и сверяем сумму с заказом. Обрабатывает два вида заказов:
 * мастер-классы (`orders` → выдача доступа) и товары каталога
 * (`productOrders` → создание отправления в Ozon Доставка).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const paymentId: unknown = body?.object?.id;

  if (typeof paymentId !== "string") {
    // Невалидное уведомление — отвечаем 200, чтобы YooKassa не повторяла бесконечно
    return NextResponse.json({ ok: true });
  }

  try {
    // Проверяем подлинность: запрашиваем платёж напрямую у YooKassa
    const payment = await getPayment(paymentId).catch((error: unknown) => {
      // Платежа нет в нашем магазине — подделка или уведомление из другого
      // (например, тестового) магазина. Повтор не поможет: отвечаем 200.
      if (String(error).includes("yookassa_get_failed_404")) return null;
      throw error;
    });
    if (!payment) {
      console.warn(`[payments/webhook] Платёж ${paymentId} не найден в ЮKassa`);
      return NextResponse.json({ ok: true });
    }

    const orderId = payment.metadata?.orderId;
    if (!orderId) {
      return NextResponse.json({ ok: true });
    }

    if (payment.metadata?.kind === "product") {
      await applyProductOrderPayment(orderId, payment);
    } else {
      const order = await getOrderById(orderId);
      if (order) await applyWorkshopPayment(order, payment);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[payments/webhook] Ошибка обработки уведомления:", error);
    // 500 — YooKassa повторит доставку позже
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
