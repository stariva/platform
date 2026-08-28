import { type NextRequest, NextResponse } from "next/server";
import { grantAccess } from "@/lib/account/access";
import { fulfillPaidProductOrder } from "@/lib/commerce/fulfillment";
import {
  getProductOrderById,
  markProductOrderCanceled,
  markProductOrderPaid,
} from "@/lib/commerce/orders";
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
    const payment = await getPayment(paymentId);

    const orderId = payment.metadata?.orderId;
    if (!orderId) {
      return NextResponse.json({ ok: true });
    }

    const isProductOrder = payment.metadata?.kind === "product";
    const canceled = payment.status === "canceled";
    const succeeded = payment.status === "succeeded" && payment.paid;

    if (isProductOrder) {
      await handleProductOrderWebhook(orderId, payment, canceled, succeeded);
    } else {
      await handleWorkshopOrderWebhook(orderId, payment, canceled, succeeded);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[payments/webhook] Ошибка обработки уведомления:", error);
    // 500 — YooKassa повторит доставку позже
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

async function handleWorkshopOrderWebhook(
  orderId: string,
  payment: Awaited<ReturnType<typeof getPayment>>,
  canceled: boolean,
  succeeded: boolean,
) {
  const order = await getOrderById(orderId);
  if (!order) return;

  if (canceled) {
    await markOrderCanceled(orderId);
    return;
  }
  if (!succeeded) return;

  const expectedValue = (order.amount / 100).toFixed(2);
  if (payment.amount.value !== expectedValue) {
    console.error(
      `[payments/webhook] Несовпадение суммы для заказа ${orderId}: ожидалось ${expectedValue}, получено ${payment.amount.value}`,
    );
    return;
  }

  const wasUpdated = await markOrderPaid(orderId);
  // Доступ выдаём в любом случае (grantAccess идемпотентен) — на случай,
  // если заказ уже был помечен оплаченным, а доступ не записался
  await grantAccess(order.userId, order.workshopSlug, orderId);

  if (wasUpdated) {
    console.info(
      `[payments/webhook] Заказ ${orderId} оплачен, доступ к «${order.workshopSlug}» выдан`,
    );
  }
}

async function handleProductOrderWebhook(
  orderId: string,
  payment: Awaited<ReturnType<typeof getPayment>>,
  canceled: boolean,
  succeeded: boolean,
) {
  const order = await getProductOrderById(orderId);
  if (!order) return;

  if (canceled) {
    await markProductOrderCanceled(orderId);
    return;
  }
  if (!succeeded) return;

  const expectedValue = (order.amountTotal / 100).toFixed(2);
  if (payment.amount.value !== expectedValue) {
    console.error(
      `[payments/webhook] Несовпадение суммы для заказа товаров ${orderId}: ожидалось ${expectedValue}, получено ${payment.amount.value}`,
    );
    return;
  }

  await markProductOrderPaid(orderId);
  await fulfillPaidProductOrder(orderId);
}
