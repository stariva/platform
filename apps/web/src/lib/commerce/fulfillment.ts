import {
  attachOzonOrder,
  claimProductOrderShipment,
  getProductOrderById,
  getProductOrderItems,
  markProductOrderOzonFailed,
} from "@/lib/commerce/orders";
import { createOzonDeliveryOrder } from "@/lib/ozon-delivery/client";
import type { DeliveryCheckoutResponse } from "@/lib/ozon-delivery/types";

/**
 * Создаёт заказ в Ozon Доставка для уже оплаченного заказа товаров. Вызывается
 * и из вебхука ЮKassa, и из ручного подтверждения оплаты продавцом
 * (paymentMethod === "seller_link") — оба пути ведут в одну и ту же отгрузку.
 */
export async function fulfillPaidProductOrder(orderId: string): Promise<void> {
  const attemptId = await claimProductOrderShipment(orderId);
  if (!attemptId) return;

  const order = await getProductOrderById(orderId);
  if (!order) return;

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
      items: items.map((i) => ({
        sku: i.ozonSku,
        quantity: i.quantity,
        price: i.price,
      })),
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
      `[commerce/fulfillment] Заказ товаров ${orderId} оплачен, создан заказ Ozon Доставка ${ozonOrder.orderId}`,
    );
  } catch (error) {
    console.error(
      `[commerce/fulfillment] КРИТИЧНО: заказ ${orderId} оплачен, но создание заказа в Ozon Доставка не удалось:`,
      error,
    );
    await markProductOrderOzonFailed(orderId, attemptId);
    throw error;
  }
}
