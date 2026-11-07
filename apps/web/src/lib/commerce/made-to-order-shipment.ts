import {
  createParcelShipment,
  isOzonBusinessDeliveryConfigured,
  quoteParcel,
} from "@/lib/ozon-business-delivery/client";
import {
  isOzonBusinessAccessError,
  ParcelNotApprovedError,
} from "@/lib/ozon-business-delivery/errors";
import type { PickupPoint } from "@/lib/ozon-delivery/types";
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
  saveMadeToOrderDeliveryPrice,
} from "./orders";

/** Чем кончился расчёт доставки: см. priceMadeToOrderDelivery. */
export type DeliveryPricingResult =
  | "ok"
  | "locked"
  | "unavailable"
  | "quote_failed";

/**
 * Покупатель выбрал пункт при доплате: считает доставку посылки, которую
 * упаковала мастер, до этого пункта и записывает пункт и цену в заказ. Доставка
 * входит в доплату, а после оплаты отправление создаётся в Ozon.
 *
 * `unavailable` — пункт не подходит, покупатель выберет другой. `quote_failed` —
 * расчёт не вышел не по вине пункта (Ozon не ответил, не подключён, не
 * доставляет этому покупателю): мастер получает алерт и может выставить
 * доплату с ручной доставкой. `locked` — заказ уже не ждёт доплату.
 */
export async function priceMadeToOrderDelivery(
  orderId: string,
  pointId: string,
  point: PickupPoint | null,
): Promise<DeliveryPricingResult> {
  const order = await getProductOrderById(orderId);
  const snapshot =
    order?.checkoutSnapshot as MadeToOrderDeliverySnapshot | null;
  if (
    order?.kind !== "made_to_order" ||
    order.status !== "awaiting_balance" ||
    !snapshot?.parcel
  ) {
    return "locked";
  }

  const failed = async (reason: string): Promise<DeliveryPricingResult> => {
    await notifyStaffAlert(
      `${orderId}/delivery-quote`,
      {
        title: `Заказ №${order.number}: Ozon не посчитал доставку`,
        message: `${reason}\nПокупатель не может оплатить доплату. Укажите стоимость доставки вручную в админке: этап «Ждёт доплату» → «Указать доставку вручную».`,
      },
      "order-delivery-quote",
    );
    return "quote_failed";
  };

  if (!isOzonBusinessDeliveryConfigured()) {
    return failed("Ozon Доставка для бизнеса не подключена.");
  }
  try {
    const quote = await quoteParcel({
      recipientPhone: order.contactPhone,
      pointId,
      parcel: snapshot.parcel,
      declaredValueKopecks: order.amountProducts,
    });
    if (!quote.available) {
      // Не подошёл пункт — это решает сам покупатель
      if (quote.cause === "point") return "unavailable";
      return failed(quote.reason ?? "Ozon отказал в расчёте доставки.");
    }
    const saved = await saveMadeToOrderDeliveryPrice(
      orderId,
      pointId,
      point,
      quote.priceKopecks,
    );
    return saved ? "ok" : "locked";
  } catch (error) {
    console.error(
      `[made-to-order] Не удалось посчитать доставку заказа ${orderId}:`,
      error,
    );
    // Ключи или права приложения сами не починятся: повторы покупателя не
    // помогут, мастер должна знать и выставить доплату с ручной доставкой
    if (isOzonBusinessAccessError(error)) {
      return failed(
        "Ozon не принял ключи Ozon Доставки для бизнеса: они неверны или отозваны, либо у приложения нет нужных доступов.",
      );
    }
    // Сбой связи пройдёт сам: мастера не тревожим, покупатель попробует ещё раз
    return "quote_failed";
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
