import type {
  productOrderItems,
  productOrderPayments,
  productOrders,
} from "@stariva/db/schema";

type OrderRow = typeof productOrders.$inferSelect;
type OrderItemRow = typeof productOrderItems.$inferSelect;
type PaymentRow = typeof productOrderPayments.$inferSelect;

const rubles = (kopecks: number) => kopecks / 100;

/** Заказ для админки: суммы в рублях, без технических полей Ozon и платежа. */
export function toAdminOrder(
  order: OrderRow,
  items: OrderItemRow[],
  payments: PaymentRow[] = [],
) {
  return {
    id: order.id,
    kind: order.kind,
    status: order.status,
    contactName: order.contactName,
    contactPhone: order.contactPhone,
    contactEmail: order.contactEmail,
    amountTotal: rubles(order.amountTotal),
    amountProducts: rubles(order.amountProducts),
    amountDelivery: rubles(order.amountDelivery),
    depositAmount:
      order.depositAmount === null ? null : rubles(order.depositAmount),
    leadTime: order.leadTime,
    paymentDueAt: order.paymentDueAt,
    approvedAt: order.approvedAt,
    depositPaidAt: order.depositPaidAt,
    declineReason: order.declineReason,
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
      price: rubles(item.price),
      options: item.options,
    })),
    // Только успешные: неоплаченные ссылки мастеру не интересны
    payments: payments
      .filter((payment) => payment.status === "succeeded")
      .map((payment) => ({
        id: payment.id,
        type: payment.type,
        amount: rubles(payment.amount),
        paidAt: payment.paidAt,
      })),
  };
}

export type AdminOrder = ReturnType<typeof toAdminOrder>;

/**
 * Статусы заказа под заказ после полной оплаты, между которыми мастер
 * переключает вручную. До этого заказ двигают кнопки этапов и платежи.
 */
export const MANUAL_STATUSES = [
  "ready_to_ship",
  "shipped",
  "delivered",
] as const;
