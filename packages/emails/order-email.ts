import {
  isOrderEmailStatus,
  orderEmailSubject,
  type StarivaOrderEmailProps,
} from "./emails/stariva-order";

/** Поля заказа на товары, из которых складывается письмо покупателю. */
export interface OrderEmailOrder {
  id: string;
  number: number;
  status: string;
  amountTotal: number;
  depositAmount: number | null;
  leadTime: string | null;
  paymentDueAt: Date | null;
  approvedAt: Date | null;
  trackingNumber: string | null;
  declineReason: string | null;
}

const dueLabel = (date: Date) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Moscow",
  }).format(date);

export interface OrderEmailInput {
  order: OrderEmailOrder;
  items: { name: string; quantity: number }[];
  to: string | null;
  siteUrl: string;
}

/**
 * Письмо покупателю о текущем статусе заказа; null — по этому статусу письмо
 * не положено или покупатель не оставил email.
 *
 * Ключ идемпотентности привязан к статусу и моменту одобрения: повторный
 * webhook или двойной клик мастера не продублируют письмо, а заново
 * согласованный заказ (вернули на согласование и одобрили с новой ценой)
 * получит письмо с новыми условиями.
 */
export function buildOrderStatusEmail({
  order,
  items,
  to,
  siteUrl,
}: OrderEmailInput) {
  const status = order.status;
  if (!to || !isOrderEmailStatus(status)) return null;

  const props: StarivaOrderEmailProps = {
    status,
    orderNumber: order.number,
    orderUrl: `${siteUrl.replace(/\/$/, "")}/order/${order.id}`,
    items,
    amountTotal: order.amountTotal,
    depositAmount: order.depositAmount,
    leadTime: order.leadTime,
    paymentDueLabel: order.paymentDueAt ? dueLabel(order.paymentDueAt) : null,
    trackingNumber: order.trackingNumber,
    declineReason: order.declineReason,
  };
  return {
    idempotencyKey: `order:${order.id}:${status}:${order.approvedAt?.getTime() ?? 0}`,
    to: [to],
    subject: orderEmailSubject(props),
    props,
  };
}
