import {
  isOzonSellerConfigured,
  type MadeToOrderDeliveryQuote,
  pushStockToOzon,
} from "@stariva/web-api";
import { isOzonDeliveryConfigured } from "@/lib/ozon-delivery/auth";
import { checkout, createOzonDeliveryOrder } from "@/lib/ozon-delivery/client";
import { formatPrice } from "@/lib/products";
import { notifyOzonOrderFailed, notifyStaffAlert } from "./order-notifications";
import {
  attachOzonOrder,
  claimMadeToOrderShipment,
  getProductOrderById,
  getProductOrderItems,
  getProductOzonSkus,
  holdMadeToOrderStock,
  markProductOrderOzonFailed,
  saveMadeToOrderQuote,
  saveOrderCheckoutSnapshot,
} from "./orders";

const refuse = (reason: string): MadeToOrderDeliveryQuote => ({
  available: false,
  reason,
  deliveryPriceKopecks: 0,
});

/** Позиции для Ozon: одно изделие разных размеров — одна строка с общим количеством. */
function ozonLines(items: { ozonSku: number; quantity: number }[]) {
  const quantities = new Map<number, number>();
  for (const { ozonSku, quantity } of items) {
    quantities.set(ozonSku, (quantities.get(ozonSku) ?? 0) + quantity);
  }
  return [...quantities].map(([sku, quantity]) => ({ sku, quantity }));
}

/**
 * Изделие готово: ставит его в остаток Ozon и считает доставку до пункта
 * покупателя. Причину отказа видит мастер в админке, поэтому текст про то,
 * что ей делать дальше. Ручной способ остаётся на случай отказа.
 */
export async function quoteMadeToOrderDelivery(
  orderId: string,
): Promise<MadeToOrderDeliveryQuote> {
  if (!isOzonDeliveryConfigured() || !isOzonSellerConfigured()) {
    return refuse("Ozon не настроен — укажите стоимость доставки вручную");
  }
  const order = await getProductOrderById(orderId);
  if (order?.kind !== "made_to_order" || order.status !== "in_production") {
    return refuse("Заказ изменился, обновите страницу");
  }
  if (order.deliveryMethod !== "pickup" || !order.deliveryPointId) {
    return refuse("Покупатель ещё не выбрал пункт выдачи");
  }

  const items = await getProductOrderItems(orderId);
  const slugs = [...new Set(items.map((item) => item.productSlug))];
  const skus = await getProductOzonSkus(slugs);
  const skuByItemId = new Map<string, number>();
  for (const item of items) {
    const sku = skus.get(item.productSlug);
    if (sku === undefined) {
      return refuse(
        `У изделия «${item.name}» нет товара в Ozon — укажите стоимость доставки вручную`,
      );
    }
    skuByItemId.set(item.id, sku);
  }

  try {
    if (!(await holdMadeToOrderStock(orderId))) {
      return refuse("Заказ изменился, обновите страницу");
    }
    const pushed = await pushStockToOzon(slugs);
    if (!slugs.every((slug) => pushed.syncedSlugs.includes(slug))) {
      return refuse("Ozon не принял остаток. Попробуйте через пару минут");
    }

    const quote = await checkout({
      items: ozonLines(
        items.map((item) => ({
          ozonSku: skuByItemId.get(item.id) as number,
          quantity: item.quantity,
        })),
      ),
      delivery: { method: "pickup", pointId: order.deliveryPointId },
      buyerPhone: order.contactPhone,
    });
    if (!quote.available) {
      // Остаток доходит до Ozon не сразу, поэтому первый отказ — обычное дело
      return refuse(
        "Ozon пока не считает доставку: остаток обновляется не сразу, или этот пункт недоступен. Попробуйте через пару минут",
      );
    }

    await saveMadeToOrderQuote(orderId, quote, skuByItemId);
    return {
      available: true,
      deliveryPriceKopecks: quote.deliveryPriceKopecks,
    };
  } catch (error) {
    console.error(
      `[made-to-order] Не удалось посчитать доставку заказа ${orderId}:`,
      error,
    );
    return refuse("Ozon не ответил. Попробуйте через пару минут");
  }
}

/**
 * Доплата получена: создаёт отправление Ozon. Покупатель мог платить до трёх
 * дней, слот из расчёта за это время устаревает, поэтому Ozon считаем заново.
 * Разницу в цене с покупателя уже не взять — о ней сообщаем мастеру. Заказ с
 * ручной доставкой не трогаем. Идемпотентно; сбой бросает ошибку, и YooKassa
 * повторит webhook.
 */
export async function createMadeToOrderShipment(
  orderId: string,
): Promise<void> {
  const attemptId = await claimMadeToOrderShipment(orderId);
  if (!attemptId) return;

  try {
    const order = await getProductOrderById(orderId);
    if (!order?.deliveryPointId) throw new Error("order_without_pickup_point");
    const delivery = {
      method: "pickup" as const,
      pointId: order.deliveryPointId,
    };

    const items = (await getProductOrderItems(orderId)).map((item) => {
      if (item.ozonSku === null) {
        throw new Error(`order_item_without_ozon_sku:${item.id}`);
      }
      return { ...item, ozonSku: item.ozonSku };
    });
    const quote = await checkout({
      items: ozonLines(items),
      delivery,
      buyerPhone: order.contactPhone,
    });
    if (!quote.available) throw new Error("ozon_delivery_not_available");
    await saveOrderCheckoutSnapshot(orderId, quote);

    const ozonOrder = await createOzonDeliveryOrder({
      items: ozonLines(items).map((line) => ({
        ...line,
        price: items.find((item) => item.ozonSku === line.sku)?.price ?? 0,
      })),
      delivery,
      recipient: {
        name: order.contactName,
        phone: order.contactPhone,
        email: order.contactEmail ?? undefined,
      },
      checkout: quote,
    });
    await attachOzonOrder(
      orderId,
      attemptId,
      ozonOrder.orderId,
      ozonOrder.postingNumbers,
    );

    if (quote.deliveryPriceKopecks !== order.amountDelivery) {
      await notifyStaffAlert(
        `${orderId}/delivery-price`,
        {
          title: `Заказ №${order.number}: доставка Ozon изменилась`,
          message: `Покупатель оплатил доставку ${formatPrice(order.amountDelivery / 100)}, а Ozon посчитал ${formatPrice(quote.deliveryPriceKopecks / 100)} на момент отправки.`,
        },
        "order-delivery-price",
      );
    }
  } catch (error) {
    console.error(
      `[made-to-order] КРИТИЧНО: заказ ${orderId} оплачен, но отправление Ozon не создано:`,
      error,
    );
    await markProductOrderOzonFailed(orderId, attemptId);
    await notifyOzonOrderFailed(orderId);
    throw error;
  }
}
