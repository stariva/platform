import type {
  productOrderItems,
  productOrderPayments,
  productOrders,
} from "@stariva/db/schema";
import { formatPrice } from "@/lib/products";
import type { PaymentOutcome } from "./made-to-order-flow";
import { describeMadeToOrderOptions } from "./made-to-order-options";

type OrderRow = typeof productOrders.$inferSelect;
type OrderItemRow = typeof productOrderItems.$inferSelect;
type PaymentRow = typeof productOrderPayments.$inferSelect;

export interface OrderMessage {
  title: string;
  message: string;
}

const money = (kopecks: number) => formatPrice(kopecks / 100);

/** Склеивает строки сообщения: пустые строки-разделители остаются, пустые значения пропускаются. */
const joinLines = (lines: (string | null | undefined | false)[]) =>
  lines.filter((line): line is string => typeof line === "string").join("\n");

function customerLines(order: OrderRow): string[] {
  return [
    `Покупатель: ${order.contactName}`,
    `Телефон: ${order.contactPhone}`,
    order.contactEmail && `Email: ${order.contactEmail}`,
  ].filter((line): line is string => Boolean(line));
}

/** Куда отправить: пункт Ozon, а у старых заявок — текст покупателя. */
function deliveryLine(order: OrderRow): string | null {
  const raw = (order.deliveryAddress ?? {}) as {
    address?: unknown;
    title?: unknown;
  };
  const address = [raw.title, raw.address].filter(
    (part): part is string => typeof part === "string" && part !== "",
  );
  if (order.deliveryPointId) {
    return `\nПункт выдачи Ozon: ${address.join(", ") || `№${order.deliveryPointId}`}`;
  }
  return order.deliveryNote ? `\nДоставка: ${order.deliveryNote}` : null;
}

function itemLines(items: OrderItemRow[]): string[] {
  return items.flatMap((item, index) => [
    `${index + 1}. ${item.name} × ${item.quantity} — ${money(item.price * item.quantity)}`,
    ...(item.options ? [`   ${describeMadeToOrderOptions(item.options)}`] : []),
  ]);
}

/** Новая заявка под заказ: оплаты ещё нет, мастер связывается и согласует условия. */
export function formatMadeToOrderRequestMessage(
  order: OrderRow,
  items: OrderItemRow[],
): OrderMessage {
  return {
    title: `Заявка под заказ №${order.number} · ${money(order.amountProducts)} по каталогу`,
    message: joinLines([
      ...customerLines(order),
      "",
      "Изделия:",
      ...itemLines(items),
      order.customerNotes && `\nПожелания: ${order.customerNotes}`,
      deliveryLine(order),
      "\nДальше: связаться с покупателем, уточнить мерки, цвет и цену,",
      "затем одобрить заявку в админке — покупателю откроется предоплата.",
    ]),
  };
}

const STAGE_LABELS: Record<PaymentRow["type"], string> = {
  deposit: "предоплата",
  balance: "доплата",
};

/** Оплата этапа заказа под заказ: в обычном случае — что делать дальше, иначе — что проверить. */
export function formatMadeToOrderPaymentMessage(
  order: OrderRow,
  payment: Pick<PaymentRow, "type" | "amount">,
  outcome: PaymentOutcome,
): OrderMessage {
  const what = `${STAGE_LABELS[payment.type]} ${money(payment.amount)} по заказу №${order.number}`;
  if (outcome === "applied") {
    return {
      title: `Получена ${what}`,
      message: joinLines([
        ...customerLines(order),
        "",
        payment.type === "deposit"
          ? "Дальше: сплести изделие, упаковать и в админке указать вес и размеры посылки: сайт посчитает доставку Ozon и выставит доплату."
          : order.checkoutSnapshot
            ? "Заказ оплачен полностью. Отправление создаётся в Ozon: дальше распечатайте этикетку в кабинете доставки Ozon и сдайте посылку в пункт Ozon."
            : "Заказ оплачен полностью. Дальше: отправить и указать номер отправления в админке.",
        payment.type === "balance" && deliveryLine(order),
      ]),
    };
  }
  return {
    title: `КРИТИЧНО: ${what} не зачтена`,
    message: joinLines([
      ...customerLines(order),
      "",
      outcome === "duplicate"
        ? "Этот этап уже был оплачен другим платежом — похоже на двойную оплату. Верните лишнее в кабинете ЮKassa."
        : "Заказ не ждал эту оплату: условия изменились или заказ отменён. Свяжитесь с покупателем и решите — зачесть вручную или вернуть.",
    ]),
  };
}

/** Текст мастеру об оплаченном заказе готовых изделий. */
export function formatPaidOrderMessage(
  order: OrderRow,
  items: OrderItemRow[],
): OrderMessage {
  return {
    title: `Оплачен заказ №${order.number} · ${money(order.amountTotal)}`,
    message: joinLines([
      ...customerLines(order),
      "",
      "Изделия:",
      ...itemLines(items),
      order.customerNotes && `\nКомментарий: ${order.customerNotes}`,
      order.ozonOrderId && `\nЗаказ Ozon Доставка: ${order.ozonOrderId}`,
    ]),
  };
}

/** Оплата прошла, а отправление в Ozon не создалось — нужна ручная обработка. */
export function formatOzonFailedMessage(order: OrderRow): OrderMessage {
  return {
    title: `КРИТИЧНО: заказ №${order.number} оплачен, но не создан в Ozon Доставка`,
    message: joinLines([
      ...customerLines(order),
      `Сумма: ${money(order.amountTotal)}`,
      "Нужна ручная обработка: отправление не создалось, YooKassa повторит попытку.",
    ]),
  };
}

/** Покупатель дополнил детали заказа под заказ. */
export function formatDetailsUpdatedMessage(
  order: OrderRow,
  items: OrderItemRow[],
): OrderMessage {
  return {
    title: `Покупатель дополнил детали заказа №${order.number}`,
    message: joinLines([
      ...customerLines(order),
      "",
      "Изделия:",
      ...itemLines(items),
      order.customerNotes && `\nПожелания: ${order.customerNotes}`,
      deliveryLine(order),
    ]),
  };
}
