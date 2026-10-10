import { test } from "bun:test";
import assert from "node:assert/strict";
import type { productOrderItems, productOrders } from "@stariva/db/schema";
import {
  formatDetailsUpdatedMessage,
  formatMadeToOrderPaymentMessage,
  formatMadeToOrderRequestMessage,
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
  status: "requested",
  amountProducts: 700000,
  amountDelivery: 0,
  amountTotal: 700000,
  currency: "RUB",
  paymentId: null,
  deliveryMethod: "manual",
  deliveryPointId: null,
  deliveryAddress: null,
  checkoutSnapshot: null,
  customerNotes: null,
  deliveryNote: null,
  depositAmount: null,
  leadTime: null,
  paymentDueAt: null,
  approvedAt: null,
  depositPaidAt: null,
  declineReason: null,
  attribution: null,
  masterNotes: null,
  trackingNumber: null,
  staffNotifiedAt: null,
  ozonOrderId: null,
  ozonPostingNumbers: null,
  ozonShipmentStatus: "pending",
  ozonShipmentAttemptId: null,
  ozonShipmentAttemptedAt: null,
  createdAt: new Date("2026-10-02T10:00:00Z"),
  paidAt: null,
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

test("request message lists the buyer, options and the approval step", () => {
  const { title, message } = formatMadeToOrderRequestMessage(order, [item]);

  assert.match(title, /Заявка под заказ №abcd1234/);
  assert.match(title, /7\s?000/);
  assert.ok(message.includes("Покупатель: Анна"));
  assert.ok(message.includes("Телефон: +7 999 123-45-67"));
  assert.ok(message.includes("1. Туника × 2"));
  assert.ok(
    message.includes(
      "Размер: По меркам · Цвет: Бежевый · Обхват груди: 92 см · Комментарий: Подлиннее",
    ),
  );
  assert.ok(message.includes("одобрить заявку в админке"));
  assert.ok(!message.includes("Email:"));
  assert.ok(!message.includes("Пожелания:"));
});

test("request message includes wishes and delivery when given", () => {
  const { message } = formatMadeToOrderRequestMessage(
    { ...order, customerNotes: "К свадьбе", deliveryNote: "Казань, СДЭК" },
    [item],
  );

  assert.ok(message.includes("Пожелания: К свадьбе"));
  assert.ok(message.includes("Доставка: Казань, СДЭК"));
});

test("deposit message tells the master to start and then bill the balance", () => {
  const { title, message } = formatMadeToOrderPaymentMessage(
    order,
    { type: "deposit", amount: 350000 },
    "applied",
  );

  assert.match(title, /^Получена предоплата 3\s?500/);
  assert.ok(message.includes("выставить доплату"));
});

test("balance message tells the master to ship", () => {
  const { title, message } = formatMadeToOrderPaymentMessage(
    order,
    { type: "balance", amount: 380000 },
    "applied",
  );

  assert.match(title, /^Получена доплата/);
  assert.ok(message.includes("номер отправления"));
});

test("a duplicate or unexpected payment is flagged as critical", () => {
  const duplicate = formatMadeToOrderPaymentMessage(
    order,
    { type: "deposit", amount: 350000 },
    "duplicate",
  );
  assert.ok(duplicate.title.startsWith("КРИТИЧНО"));
  assert.ok(duplicate.message.includes("двойную оплату"));

  const unexpected = formatMadeToOrderPaymentMessage(
    order,
    { type: "balance", amount: 380000 },
    "unexpected",
  );
  assert.ok(unexpected.title.startsWith("КРИТИЧНО"));
  assert.ok(unexpected.message.includes("не ждал эту оплату"));
});

test("stock order message mentions the Ozon order", () => {
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
