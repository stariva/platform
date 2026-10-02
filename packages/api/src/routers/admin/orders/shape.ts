import type { productOrderItems, productOrders } from "@stariva/db/schema";

type OrderRow = typeof productOrders.$inferSelect;
type OrderItemRow = typeof productOrderItems.$inferSelect;

/** Заказ для админки: суммы в рублях, без технических полей Ozon и платежа. */
export function toAdminOrder(order: OrderRow, items: OrderItemRow[]) {
  return {
    id: order.id,
    kind: order.kind,
    status: order.status,
    contactName: order.contactName,
    contactPhone: order.contactPhone,
    contactEmail: order.contactEmail,
    amountTotal: order.amountTotal / 100,
    amountDelivery: order.amountDelivery / 100,
    customerNotes: order.customerNotes,
    deliveryNote: order.deliveryNote,
    masterNotes: order.masterNotes,
    trackingNumber: order.trackingNumber,
    ozonOrderId: order.ozonOrderId,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    items: items.map((item) => ({
      id: item.id,
      productSlug: item.productSlug,
      name: item.name,
      quantity: item.quantity,
      price: item.price / 100,
      options: item.options,
    })),
  };
}

export type AdminOrder = ReturnType<typeof toAdminOrder>;

/**
 * Статусы заказа под заказ, между которыми мастер переключает вручную.
 * «Ожидает оплаты», «Отменён» и «Возврат» меняет только платёжная система.
 */
export const MADE_TO_ORDER_STATUSES = [
  "awaiting_details",
  "in_production",
  "ready_to_ship",
  "shipped",
  "delivered",
] as const;
