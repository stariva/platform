import { expect, test } from "bun:test";
import type { WorkshopOrder } from "@/lib/payments/orders";
import type { YooKassaPayment } from "@/lib/payments/yookassa";
import { workshopOrderCookieValue } from "./order-cookie";
import { canReuseOrder, pendingConfirmationUrl } from "./pending-order";

const order = {
  id: "order-1",
  userId: "buyer",
  workshopSlug: "elka-makrame",
  amount: 99000,
  status: "pending",
  paymentId: "payment-1",
  telegramToken: "secret",
} as WorkshopOrder;
const cookie = workshopOrderCookieValue(order);
const purchase = {
  userId: "buyer",
  workshopSlug: "elka-makrame",
  amountKopecks: 99000,
};

test("reuses the pending order this browser started", () => {
  expect(canReuseOrder(order, cookie, purchase)).toBe(true);
});

test("does not reuse another browser's order for the same email", () => {
  expect(canReuseOrder(order, undefined, purchase)).toBe(false);
  expect(canReuseOrder(order, "order-1.guess", purchase)).toBe(false);
});

test("does not reuse a settled, paymentless or different order", () => {
  for (const changed of [
    { status: "canceled" },
    { status: "paid" },
    { paymentId: null },
    { paymentId: "robokassa:1001" },
    { userId: "someone-else" },
    { workshopSlug: "other" },
    { amount: 149000 },
  ] as Partial<WorkshopOrder>[]) {
    expect(canReuseOrder({ ...order, ...changed }, cookie, purchase)).toBe(
      false,
    );
  }
});

const payment: YooKassaPayment = {
  id: "payment-1",
  status: "pending",
  paid: false,
  amount: { value: "990.00", currency: "RUB" },
  confirmation: {
    type: "redirect",
    confirmation_url: "https://yoomoney.ru/checkout/payments/v2/contract",
  },
};

test("returns the payment link while YooKassa still waits for payment", () => {
  expect(pendingConfirmationUrl(payment, 99000)).toBe(
    "https://yoomoney.ru/checkout/payments/v2/contract",
  );
});

test("needs a new payment once the old one expired, settled or changed", () => {
  for (const changed of [
    { status: "canceled" },
    { status: "succeeded", paid: true },
    { status: "waiting_for_capture" },
    { amount: { value: "1490.00", currency: "RUB" } },
    { confirmation: undefined },
  ] as Partial<YooKassaPayment>[]) {
    expect(
      pendingConfirmationUrl({ ...payment, ...changed }, 99000),
    ).toBeNull();
  }
});
