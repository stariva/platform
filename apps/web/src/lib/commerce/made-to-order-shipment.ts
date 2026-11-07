import type {
  MadeToOrderDeliveryQuote,
  MadeToOrderParcel,
} from "@stariva/web-api";
import {
  createParcelShipment,
  isOzonBusinessDeliveryConfigured,
  quoteParcel,
} from "@/lib/ozon-business-delivery/client";
import { ParcelNotApprovedError } from "@/lib/ozon-business-delivery/errors";
import { formatPrice } from "@/lib/products";
import { notifyOzonOrderFailed, notifyStaffAlert } from "./order-notifications";
import {
  attachMadeToOrderShipment,
  claimMadeToOrderShipment,
  getProductOrderById,
  getProductOrderItems,
  type MadeToOrderDeliverySnapshot,
  markMadeToOrderShipmentUnapproved,
  markProductOrderOzonFailed,
  saveMadeToOrderQuote,
} from "./orders";

const refuse = (reason: string): MadeToOrderDeliveryQuote => ({
  available: false,
  reason,
  deliveryPriceKopecks: 0,
});

/**
 * Изделие готово: считает доставку посылки с весом и размерами, которые указал
 * мастер, до пункта покупателя. Причину отказа мастер видит в админке, поэтому
 * текст про то, что делать дальше: ручной способ остаётся на любой случай.
 */
export async function quoteMadeToOrderDelivery(
  orderId: string,
  parcel: MadeToOrderParcel,
): Promise<MadeToOrderDeliveryQuote> {
  if (!isOzonBusinessDeliveryConfigured()) {
    return refuse(
      "Ozon Доставка для бизнеса ещё не подключена — укажите стоимость доставки вручную",
    );
  }
  const order = await getProductOrderById(orderId);
  if (order?.kind !== "made_to_order" || order.status !== "in_production") {
    return refuse("Заказ изменился, обновите страницу");
  }
  if (order.deliveryMethod !== "pickup" || !order.deliveryPointId) {
    return refuse("Покупатель ещё не выбрал пункт выдачи");
  }

  try {
    const quote = await quoteParcel({
      recipientPhone: order.contactPhone,
      pointId: order.deliveryPointId,
      parcel,
      declaredValueKopecks: order.amountProducts,
    });
    if (!quote.available) {
      return refuse(
        quote.reason ??
          "Ozon не доставит такую посылку в этот пункт. Проверьте вес и размеры или укажите стоимость вручную",
      );
    }
    const saved = await saveMadeToOrderQuote(
      orderId,
      { parcel, priceKopecks: quote.priceKopecks },
      order.deliveryPointId,
    );
    if (!saved) {
      return refuse(
        "Покупатель сменил пункт выдачи, пока шёл расчёт. Посчитайте доставку ещё раз",
      );
    }
    return { available: true, deliveryPriceKopecks: quote.priceKopecks };
  } catch (error) {
    console.error(
      `[made-to-order] Не удалось посчитать доставку заказа ${orderId}:`,
      error,
    );
    return refuse("Ozon не ответил. Попробуйте через пару минут");
  }
}

/**
 * Доплата получена: создаёт и подтверждает отправление Ozon. Покупатель мог
 * платить до трёх дней, поэтому Ozon считаем заново. Разницу в цене с покупателя
 * уже не взять — о ней сообщаем мастеру. Заказ с ручной доставкой не трогаем.
 * Идемпотентно; сбой бросает ошибку, и YooKassa повторит webhook.
 *
 * `balancePaymentId` — оплата доплаты, из-за которой всё началось: если заказ
 * создан в Ozon, но не подтверждён, её уведомление мастеру отправится заново
 * (см. markMadeToOrderShipmentUnapproved).
 */
export async function createMadeToOrderShipment(
  orderId: string,
  balancePaymentId: string,
): Promise<void> {
  const attemptId = await claimMadeToOrderShipment(orderId);
  if (!attemptId) return;

  try {
    const order = await getProductOrderById(orderId);
    const snapshot =
      order?.checkoutSnapshot as MadeToOrderDeliverySnapshot | null;
    if (!order?.deliveryPointId || !snapshot?.parcel) {
      throw new Error("order_without_parcel_or_pickup_point");
    }
    const request = {
      recipientPhone: order.contactPhone,
      pointId: order.deliveryPointId,
      parcel: snapshot.parcel,
      declaredValueKopecks: order.amountProducts,
    };

    const quote = await quoteParcel(request);
    if (!quote.available) throw new Error("ozon_delivery_not_available");

    const items = await getProductOrderItems(orderId);
    const shipment = await createParcelShipment({
      ...request,
      externalOrderId: orderId,
      recipientName: order.contactName,
      items: items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        priceKopecks: item.price,
      })),
    });
    await attachMadeToOrderShipment(
      orderId,
      attemptId,
      shipment.orderId,
      shipment.postingNumbers,
    );

    if (quote.priceKopecks !== order.amountDelivery) {
      await notifyStaffAlert(
        `${orderId}/delivery-price`,
        {
          title: `Заказ №${order.number}: доставка Ozon изменилась`,
          message: `Покупатель оплатил доставку ${formatPrice(order.amountDelivery / 100)}, а Ozon посчитал ${formatPrice(quote.priceKopecks / 100)} на момент отправки.`,
        },
        "order-delivery-price",
      );
    }
  } catch (error) {
    if (error instanceof ParcelNotApprovedError) {
      // Заказ в Ozon уже есть. Повтор webhook создал бы второй, поэтому
      // номера сохраняем и ошибку не бросаем: подтверждает мастер. Сказать ей
      // об этом должно уведомление об оплате: сохранение номеров заодно
      // снимает отметку о нём, и оно уйдёт снова, даже если уже уходило
      console.error(
        `[made-to-order] Заказ ${orderId} создан в Ozon, но не подтверждён:`,
        error,
      );
      await markMadeToOrderShipmentUnapproved(
        orderId,
        attemptId,
        error.parcel.orderId,
        error.parcel.postingNumbers,
        balancePaymentId,
      );
      return;
    }
    console.error(
      `[made-to-order] КРИТИЧНО: заказ ${orderId} оплачен, но отправление Ozon не создано:`,
      error,
    );
    await markProductOrderOzonFailed(orderId, attemptId);
    await notifyOzonOrderFailed(orderId);
    throw error;
  }
}
