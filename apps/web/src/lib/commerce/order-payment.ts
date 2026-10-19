import {
  notifyCustomer,
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
  getProductOrderCustomerEmail,
  getProductOrderItems,
  listOrderPayments,
  markOrderPaymentCanceled,
  markOrderPaymentSucceeded,
  markProductOrderCanceled,
  markProductOrderOzonFailed,
  markProductOrderPaid,
} from "@/lib/commerce/orders";
import { issueNpdReceipt } from "@/lib/npd/issue";
import { createOzonDeliveryOrder } from "@/lib/ozon-delivery/client";
import type { DeliveryCheckoutResponse } from "@/lib/ozon-delivery/types";
import {
  getPayment,
  kopecksToValue,
  type YooKassaPayment,
} from "@/lib/payments/yookassa";

type ProductOrder = NonNullable<
  Awaited<ReturnType<typeof getProductOrderById>>
>;

/**
 * Применяет статус платежа YooKassa к заказу товаров: оплата → письмо
 * покупателю, отправление в Ozon Доставка, уведомление мастеру. Платёж должен
 * быть получен напрямую из API YooKassa, а не из тела уведомления. Идемпотентно:
 * его вызывают и вебхук, и страница заказа, и они могут пересечься.
 */
export async function applyProductOrderPayment(
  orderId: string,
  payment: YooKassaPayment,
): Promise<void> {
  const canceled = payment.status === "canceled";
  const succeeded = payment.status === "succeeded" && payment.paid;

  const order = await getProductOrderById(orderId);
  if (!order) return;

  // Изделие под заказ оплачивается по этапам: ни Ozon, ни склада
  if (order.kind === "made_to_order") {
    await handleMadeToOrderPayment(order, payment, canceled, succeeded);
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

  // Письмо покупателю — до Ozon: сбой отправления не должен задержать
  // подтверждение оплаты, а повтор webhook письмо не продублирует
  if (await markProductOrderPaid(orderId)) {
    await notifyCustomer(orderId, "paid");
  }

  let attemptId: string | null = null;
  try {
    // До Ozon: сбой отправления бросает ошибку, а чек нужен в любом случае
    const items = await getProductOrderItems(orderId);
    await issueNpdReceipt({
      payment,
      target: { kind: "product", orderId },
      services: [
        ...items.map((i) => ({
          name: i.name,
          amount: i.price,
          quantity: i.quantity,
        })),
        ...(order.amountDelivery > 0
          ? [{ name: "Доставка", amount: order.amountDelivery, quantity: 1 }]
          : []),
      ],
      email: {
        to: await getProductOrderCustomerEmail(order),
        subject: `заказу №${order.number}`,
      },
      expected: 1,
    });

    attemptId = await claimProductOrderShipment(orderId);
    if (!attemptId) return;

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
    // Подготовка чека могла упасть до захвата отправления.
    attemptId ??= await claimProductOrderShipment(orderId);
    if (attemptId) {
      await markProductOrderOzonFailed(orderId, attemptId);
      await notifyOzonOrderFailed(orderId);
    }
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
  order: ProductOrder,
  payment: YooKassaPayment,
  canceled: boolean,
  succeeded: boolean,
) {
  const orderId = order.id;
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
      await notifyCustomer(orderId);
    } else {
      console.error(
        `[payments/webhook] КРИТИЧНО: заказ под заказ ${orderId} не ждал оплату ${row.id} (${row.type})`,
      );
    }
  }

  // Чек на каждый этап — до уведомления мастеру, которое может бросить ошибку
  const [items, payments] = await Promise.all([
    getProductOrderItems(orderId),
    listOrderPayments(orderId),
  ]);
  const stage = row.type === "deposit" ? "предоплата" : "доплата";
  await issueNpdReceipt({
    payment,
    target: { kind: "product", orderId },
    services: [
      {
        name: `${items[0]?.name ?? "Изделие на заказ"}, ${stage}`,
        amount: row.amount,
        quantity: 1,
      },
    ],
    email: {
      to: await getProductOrderCustomerEmail(order),
      subject: `заказу №${order.number}`,
    },
    expected: payments.filter((p) => p.status === "succeeded").length,
  });

  // При сбое бросает ошибку — YooKassa повторит webhook, и мы отправим снова
  await notifyMadeToOrderPayment(row.id);
}

/**
 * Покупатель открыл страницу заказа, а вебхук ещё не отметил оплату — потерян
 * или опаздывает. Спрашиваем статус у YooKassa сами. Только заказы товаров из
 * наличия: у «под заказ» платежей несколько, их ведёт вебхук. Сбой не страшен —
 * вернём заказ как есть, вебхук или следующее открытие страницы догонят.
 */
export async function syncPendingProductOrder(
  order: ProductOrder,
): Promise<ProductOrder> {
  if (
    order.kind !== "stock" ||
    order.status !== "pending" ||
    !order.paymentId
  ) {
    return order;
  }
  try {
    await applyProductOrderPayment(order.id, await getPayment(order.paymentId));
  } catch (error) {
    console.error(
      `[payments] Не удалось сверить заказ товаров ${order.id}:`,
      error,
    );
  }
  return (await getProductOrderById(order.id)) ?? order;
}
