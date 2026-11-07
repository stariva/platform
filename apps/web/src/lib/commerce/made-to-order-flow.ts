import type { productOrderPayments, productOrders } from "@stariva/db/schema";

type OrderRow = typeof productOrders.$inferSelect;
type PaymentRow = typeof productOrderPayments.$inferSelect;

export type MadeToOrderPaymentType = PaymentRow["type"];

type PaymentStepOrder = Pick<
  OrderRow,
  "kind" | "status" | "amountTotal" | "depositAmount" | "paymentDueAt"
>;

/** Сколько стоит этап: предоплата фиксируется при одобрении, доплата — всё остальное. */
export function madeToOrderStageAmount(
  order: Pick<OrderRow, "amountTotal" | "depositAmount">,
  type: MadeToOrderPaymentType,
): number | null {
  if (order.depositAmount === null) return null;
  return type === "deposit"
    ? order.depositAmount
    : order.amountTotal - order.depositAmount;
}

/** Ждёт ли заказ оплату, срок которой уже вышел, — тогда платить можно только после продления мастером. */
export function isPaymentOverdue(
  order: Pick<OrderRow, "status" | "paymentDueAt">,
  now = new Date(),
): boolean {
  return (
    (order.status === "awaiting_deposit" ||
      order.status === "awaiting_balance") &&
    order.paymentDueAt !== null &&
    order.paymentDueAt < now
  );
}

/**
 * Какую оплату заказ под заказ ждёт прямо сейчас: предоплату после одобрения
 * мастером или доплату после изготовления. null — платить нечего или срок вышел.
 */
export function madeToOrderPaymentStep(
  order: PaymentStepOrder,
  now = new Date(),
): { type: MadeToOrderPaymentType; amount: number } | null {
  if (order.kind !== "made_to_order" || isPaymentOverdue(order, now)) {
    return null;
  }
  const type =
    order.status === "awaiting_deposit"
      ? "deposit"
      : order.status === "awaiting_balance"
        ? "balance"
        : null;
  if (!type) return null;
  const amount = madeToOrderStageAmount(order, type);
  return amount !== null && amount > 0 ? { type, amount } : null;
}

/**
 * Доплата ждёт доставку: мастер указала параметры посылки, а покупатель ещё не
 * выбрал пункт, и Ozon не посчитал стоимость. Пока так, доплата — это только
 * изделие, платить её рано. Заказ с ручной доставкой (расчёта нет вовсе) и
 * предоплата сюда не относятся.
 */
export function needsDeliveryQuote(
  order: Pick<OrderRow, "kind" | "status" | "checkoutSnapshot">,
): boolean {
  if (order.kind !== "made_to_order" || order.status !== "awaiting_balance") {
    return false;
  }
  const snapshot = order.checkoutSnapshot as {
    parcel?: unknown;
    priceKopecks?: number | null;
  } | null;
  return Boolean(snapshot?.parcel) && snapshot?.priceKopecks == null;
}

/** Доплату берём, когда выбран пункт и посчитана доставка до него. */
export function isDeliveryQuoteRequiredToPay(
  order: PaymentStepOrder & Pick<OrderRow, "checkoutSnapshot">,
  now = new Date(),
): boolean {
  return (
    madeToOrderPaymentStep(order, now)?.type === "balance" &&
    needsDeliveryQuote(order)
  );
}

/**
 * Строки чека на оплату этапа. В доплату входит доставка: в чеке она отдельной
 * строкой, как и у заказа со склада. Сумма строк равна сумме платежа.
 */
export function madeToOrderReceiptLines(
  itemName: string,
  payment: Pick<PaymentRow, "type" | "amount">,
  amountDelivery: number,
): { name: string; amount: number; quantity: number }[] {
  if (payment.type === "deposit") {
    return [
      {
        name: `${itemName}, предоплата`,
        amount: payment.amount,
        quantity: 1,
      },
    ];
  }
  // Оплата могла прийти не на ту сумму (старая ссылка): тогда строку не делим
  if (amountDelivery <= 0 || payment.amount <= amountDelivery) {
    return [
      { name: `${itemName}, доплата`, amount: payment.amount, quantity: 1 },
    ];
  }
  return [
    {
      name: `${itemName}, доплата`,
      amount: payment.amount - amountDelivery,
      quantity: 1,
    },
    { name: "Доставка", amount: amountDelivery, quantity: 1 },
  ];
}

/**
 * Чем обернулась успешная оплата этапа:
 * - `applied` — заказ продвинулся благодаря ей;
 * - `duplicate` — этот этап уже оплачен другим платежом, деньги нужно вернуть;
 * - `unexpected` — заказ её не ждал (сумму изменили, заказ отменён) — разобраться вручную.
 */
export type PaymentOutcome = "applied" | "duplicate" | "unexpected";

export function paymentOutcome(
  order: Pick<OrderRow, "depositPaidAt" | "paidAt">,
  payments: Pick<PaymentRow, "id" | "type" | "status" | "paidAt">[],
  payment: Pick<PaymentRow, "id" | "type" | "paidAt">,
): PaymentOutcome {
  const earlier = payments.find(
    (other) =>
      other.id !== payment.id &&
      other.type === payment.type &&
      other.status === "succeeded" &&
      other.paidAt !== null &&
      (payment.paidAt === null || other.paidAt < payment.paidAt),
  );
  if (earlier) return "duplicate";
  const stagePaid =
    payment.type === "deposit"
      ? order.depositPaidAt !== null
      : order.paidAt !== null;
  return stagePaid ? "applied" : "unexpected";
}
