import type { productOrderItems, productOrders } from "@stariva/db/schema";
import { formatPrice } from "@/lib/products";
import { describeMadeToOrderOptions } from "./made-to-order-options";

type OrderRow = typeof productOrders.$inferSelect;
type OrderItemRow = typeof productOrderItems.$inferSelect;

export interface OrderMessage {
  title: string;
  message: string;
}

export const shortOrderId = (orderId: string) => orderId.slice(0, 8);

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

function itemLines(items: OrderItemRow[]): string[] {
  return items.flatMap((item, index) => [
    `${index + 1}. ${item.name} × ${item.quantity} — ${money(item.price * item.quantity)}`,
    ...(item.options ? [`   ${describeMadeToOrderOptions(item.options)}`] : []),
  ]);
}

/** Текст мастеру об оплаченном заказе: что заказали и что делать дальше. */
export function formatPaidOrderMessage(
  order: OrderRow,
  items: OrderItemRow[],
): OrderMessage {
  if (order.kind === "made_to_order") {
    return {
      title: `Оплачен заказ под заказ №${shortOrderId(order.id)} · ${money(order.amountTotal)}`,
      message: joinLines([
        ...customerLines(order),
        "",
        "Изделия:",
        ...itemLines(items),
        order.customerNotes && `\nПожелания: ${order.customerNotes}`,
        "\nДальше: связаться с покупателем, уточнить мерки, цвет и способ доставки.",
        "Покупатель может дополнить детали на странице заказа.",
      ]),
    };
  }
  return {
    title: `Оплачен заказ №${shortOrderId(order.id)} · ${money(order.amountTotal)}`,
    message: joinLines([
      ...customerLines(order),
      "",
      "Изделия:",
      ...itemLines(items),
      order.ozonOrderId && `\nЗаказ Ozon Доставка: ${order.ozonOrderId}`,
    ]),
  };
}

/** Оплата прошла, а отправление в Ozon не создалось — нужна ручная обработка. */
export function formatOzonFailedMessage(order: OrderRow): OrderMessage {
  return {
    title: `КРИТИЧНО: заказ №${shortOrderId(order.id)} оплачен, но не создан в Ozon Доставка`,
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
    title: `Покупатель дополнил детали заказа №${shortOrderId(order.id)}`,
    message: joinLines([
      ...customerLines(order),
      "",
      "Изделия:",
      ...itemLines(items),
      order.customerNotes && `\nПожелания: ${order.customerNotes}`,
      order.deliveryNote && `\nДоставка: ${order.deliveryNote}`,
    ]),
  };
}
