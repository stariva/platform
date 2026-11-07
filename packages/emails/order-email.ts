import {
  isOrderEmailStatus,
  type OrderEmailItem,
  orderEmailSubject,
  type StarivaOrderEmailProps,
} from "./emails/stariva-order";

/** Поля заказа на товары, из которых складывается письмо покупателю. */
export interface OrderEmailOrder {
  id: string;
  number: number;
  status: string;
  amountTotal: number;
  amountDelivery: number;
  depositAmount: number | null;
  leadTime: string | null;
  paymentDueAt: Date | null;
  approvedAt: Date | null;
  trackingNumber: string | null;
  declineReason: string | null;
  /** Под заказ: посылка и расчёт доставки (priceKopecks пуст, пока покупатель не выбрал пункт). */
  checkoutSnapshot: unknown;
}

/**
 * Изделие готово, мастер указал параметры посылки, а покупатель ещё не выбрал
 * пункт: доставки в доплате пока нет. Так же считает витрина
 * (apps/web, made-to-order-flow.ts).
 */
function deliveryQuoteNeeded(order: OrderEmailOrder): boolean {
  if (order.status !== "awaiting_balance") return false;
  const snapshot = order.checkoutSnapshot as {
    parcel?: unknown;
    priceKopecks?: number | null;
  } | null;
  return Boolean(snapshot?.parcel) && snapshot?.priceKopecks == null;
}

const dueLabel = (date: Date) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Moscow",
  }).format(date);

export interface OrderEmailInput {
  order: OrderEmailOrder;
  items: OrderEmailItem[];
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
    amountDelivery: order.amountDelivery,
    depositAmount: order.depositAmount,
    leadTime: order.leadTime,
    paymentDueLabel: order.paymentDueAt ? dueLabel(order.paymentDueAt) : null,
    trackingNumber: order.trackingNumber,
    declineReason: order.declineReason,
    deliveryQuoteNeeded: deliveryQuoteNeeded(order),
  };
  return {
    // Доплату могут выставить заново с другой доставкой: это другое письмо,
    // и с прежним ключом Resend отклонил бы его (409). Ручная доставка за 0 ₽
    // не меняет итог, но меняет текст (оплатить вместо «выберите пункт»), поэтому
    // в ключ входит и признак ожидания расчёта
    idempotencyKey: `order:${order.id}:${status}:${order.approvedAt?.getTime() ?? 0}${status === "awaiting_balance" ? `:${order.amountTotal}:${props.deliveryQuoteNeeded ? "quote" : "ready"}` : ""}`,
    to: [to],
    subject: orderEmailSubject(props),
    props,
  };
}
