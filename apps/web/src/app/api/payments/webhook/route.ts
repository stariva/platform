import { type NextRequest, NextResponse } from "next/server";
import {
  notifyMadeToOrderPayment,
  notifyOrderPaid,
  notifyOzonOrderFailed,
} from "@/lib/commerce/order-notifications";
import {
  applyMadeToOrderPayment,
  attachOzonOrder,
  claimProductOrderShipment,
  getOrderPayment,
  getProductOrderById,
  getProductOrderItems,
  markOrderPaymentCanceled,
  markOrderPaymentSucceeded,
  markProductOrderCanceled,
  markProductOrderOzonFailed,
  markProductOrderPaid,
} from "@/lib/commerce/orders";
import { createOzonDeliveryOrder } from "@/lib/ozon-delivery/client";
import type { DeliveryCheckoutResponse } from "@/lib/ozon-delivery/types";
import { getOrderById } from "@/lib/payments/orders";
import { getPayment, kopecksToValue } from "@/lib/payments/yookassa";
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
      await handleWorkshopOrderWebhook(orderId, payment);
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
) {
  const order = await getOrderById(orderId);
  if (!order) return;
  await applyWorkshopPayment(order, payment);
}

async function handleProductOrderWebhook(
  orderId: string,
  payment: Awaited<ReturnType<typeof getPayment>>,
  canceled: boolean,
  succeeded: boolean,
) {
  const order = await getProductOrderById(orderId);
  if (!order) return;

  // Изделие под заказ оплачивается по этапам: ни Ozon, ни склада
  if (order.kind === "made_to_order") {
    await handleMadeToOrderPayment(orderId, payment, canceled, succeeded);
    return;
  }

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

  const attemptId = await claimProductOrderShipment(orderId);
  if (!attemptId) return;

  try {
    const items = await getProductOrderItems(orderId);
    const delivery =
      order.deliveryMethod === "pickup"
        ? { method: "pickup" as const, pointId: order.deliveryPointId ?? "" }
        : {
            method: "courier" as const,
            address:
              (order.deliveryAddress as { address: string })?.address ?? "",
            latitude: (order.deliveryAddress as { lat: number })?.lat ?? 0,
            longitude: (order.deliveryAddress as { lng: number })?.lng ?? 0,
          };

    const ozonOrder = await createOzonDeliveryOrder({
      items: items.map((i) => {
        if (i.ozonSku === null) {
          throw new Error(`order_item_without_ozon_sku:${i.id}`);
        }
        return { sku: i.ozonSku, quantity: i.quantity, price: i.price };
      }),
      delivery,
      recipient: {
        name: order.contactName,
        phone: order.contactPhone,
        email: order.contactEmail ?? undefined,
      },
      checkout: order.checkoutSnapshot as DeliveryCheckoutResponse,
    });

    await attachOzonOrder(
      orderId,
      attemptId,
      ozonOrder.orderId,
      ozonOrder.postingNumbers,
    );
    console.info(
      `[payments/webhook] Заказ товаров ${orderId} оплачен, создан заказ Ozon Доставка ${ozonOrder.orderId}`,
    );
  } catch (error) {
    console.error(
      `[payments/webhook] КРИТИЧНО: заказ ${orderId} оплачен, но создание заказа в Ozon Доставка не удалось:`,
      error,
    );
    await markProductOrderOzonFailed(orderId, attemptId);
    await notifyOzonOrderFailed(orderId);
    throw error;
  }

  // Заказ уже создан в Ozon — сбой уведомления не должен заставлять YooKassa
  // повторять webhook, поэтому здесь он только попадает в лог.
  try {
    await notifyOrderPaid(orderId);
  } catch (error) {
    console.error(
      `[payments/webhook] Не удалось уведомить мастера о заказе ${orderId}:`,
      error,
    );
  }
}

/**
 * Оплата этапа заказа под заказ. Сумму сверяем со строкой платежа — ровно
 * столько мы запросили у YooKassa. Успешная оплата записывается всегда, даже
 * если заказ её уже не ждёт (двойная оплата, мастер изменил условия): деньги
 * пришли, и мастер должен об этом узнать.
 */
async function handleMadeToOrderPayment(
  orderId: string,
  payment: Awaited<ReturnType<typeof getPayment>>,
  canceled: boolean,
  succeeded: boolean,
) {
  const rowId = payment.metadata?.orderPaymentId;
  const row = rowId ? await getOrderPayment(rowId) : null;
  if (!row || row.orderId !== orderId) {
    console.error(
      `[payments/webhook] Платёж ${payment.id} по заказу под заказ ${orderId} без своей строки платежа`,
    );
    return;
  }

  if (canceled) {
    await markOrderPaymentCanceled(row.id);
    return;
  }
  if (!succeeded) return;

  if (payment.amount.value !== kopecksToValue(row.amount)) {
    console.error(
      `[payments/webhook] Несовпадение суммы платежа ${row.id} по заказу ${orderId}: ожидалось ${kopecksToValue(row.amount)}, получено ${payment.amount.value}`,
    );
    return;
  }

  if (await markOrderPaymentSucceeded(row.id)) {
    const applied = await applyMadeToOrderPayment(
      orderId,
      row.type,
      row.amount,
    );
    if (applied) {
      console.info(
        `[payments/webhook] Заказ под заказ ${orderId}: оплачен этап ${row.type}`,
      );
    } else {
      console.error(
        `[payments/webhook] КРИТИЧНО: заказ под заказ ${orderId} не ждал оплату ${row.id} (${row.type})`,
      );
    }
  }

  // При сбое бросает ошибку — YooKassa повторит webhook, и мы отправим снова
  await notifyMadeToOrderPayment(row.id);
}
