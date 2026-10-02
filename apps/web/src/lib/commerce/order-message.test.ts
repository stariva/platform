import { test } from "bun:test";
import assert from "node:assert/strict";
import type { productOrderItems, productOrders } from "@stariva/db/schema";
import {
  formatDetailsUpdatedMessage,
  formatOzonFailedMessage,
  formatPaidOrderMessage,
} from "./order-message";

type OrderRow = typeof productOrders.$inferSelect;
type ItemRow = typeof productOrderItems.$inferSelect;

const order: OrderRow = {
  id: "abcd1234-0000-0000-0000-000000000000",
  kind: "made_to_order",
  userId: null,
  contactName: "Анна",
  contactPhone: "+7 999 123-45-67",
  contactEmail: null,
  status: "awaiting_details",
  amountProducts: 700000,
  amountDelivery: 0,
  amountTotal: 700000,
  currency: "RUB",
  paymentId: "pay-1",
  deliveryMethod: "manual",
  deliveryPointId: null,
  deliveryAddress: null,
  checkoutSnapshot: null,
  customerNotes: null,
  deliveryNote: null,
  masterNotes: null,
  trackingNumber: null,
  staffNotifiedAt: null,
  ozonOrderId: null,
  ozonPostingNumbers: null,
  ozonShipmentStatus: "pending",
  ozonShipmentAttemptId: null,
  ozonShipmentAttemptedAt: null,
  createdAt: new Date("2026-10-02T10:00:00Z"),
  paidAt: new Date("2026-10-02T10:05:00Z"),
};

const item: ItemRow = {
  id: "item-1",
  orderId: order.id,
  productSlug: "tunika-5565",
  ozonSku: null,
  name: "Туника",
  price: 350000,
  quantity: 2,
  options: {
    size: "По меркам",
    color: "Бежевый",
    measurements: [{ label: "Обхват груди", value: "92" }],
    comment: "Подлиннее",
  },
};

test("made-to-order message lists the buyer, options and next step", () => {
  const { title, message } = formatPaidOrderMessage(order, [item]);

  assert.match(title, /под заказ №abcd1234/);
  assert.match(title, /7\s?000/);
  assert.ok(message.includes("Покупатель: Анна"));
  assert.ok(message.includes("Телефон: +7 999 123-45-67"));
  assert.ok(message.includes("1. Туника × 2"));
  assert.ok(
    message.includes(
      "Размер: По меркам · Цвет: Бежевый · Обхват груди: 92 см · Комментарий: Подлиннее",
    ),
  );
  assert.ok(message.includes("уточнить мерки, цвет и способ доставки"));
  assert.ok(!message.includes("Email:"));
  assert.ok(!message.includes("Пожелания:"));
});

test("made-to-order message includes the buyer's wishes when given", () => {
  const { message } = formatPaidOrderMessage(
    { ...order, customerNotes: "К свадьбе" },
    [item],
  );

  assert.ok(message.includes("Пожелания: К свадьбе"));
});

test("stock order message mentions the Ozon order instead of next steps", () => {
  const { title, message } = formatPaidOrderMessage(
    { ...order, kind: "stock", ozonOrderId: "OZ-1" },
    [{ ...item, ozonSku: 123, options: null }],
  );

  assert.ok(!title.includes("под заказ"));
  assert.ok(message.includes("Заказ Ozon Доставка: OZ-1"));
  assert.ok(!message.includes("Размер:"));
});

test("details-updated message carries the delivery note", () => {
  const { title, message } = formatDetailsUpdatedMessage(
    { ...order, deliveryNote: "Казань, ПВЗ СДЭК" },
    [item],
  );

  assert.match(title, /дополнил детали заказа №abcd1234/);
  assert.ok(message.includes("Доставка: Казань, ПВЗ СДЭК"));
});

test("Ozon failure alert is flagged as critical", () => {
  const { title, message } = formatOzonFailedMessage({
    ...order,
    kind: "stock",
  });

  assert.ok(title.startsWith("КРИТИЧНО"));
  assert.ok(message.includes("Телефон: +7 999 123-45-67"));
});
