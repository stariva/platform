import { expect, test } from "bun:test";

import { buildOrderStatusEmail } from "./order-email";

const approvedAt = new Date("2026-10-13T09:00:00Z");
const order = {
  id: "order-1",
  number: 1042,
  status: "awaiting_deposit",
  amountTotal: 640000,
  depositAmount: 300000,
  leadTime: "2–3 недели",
  paymentDueAt: new Date("2026-10-16T09:00:00Z"),
  approvedAt,
  trackingNumber: null,
  declineReason: null,
};
const send = (
  overrides: Partial<typeof order>,
  to: string | null = "b@x.test",
) =>
  buildOrderStatusEmail({
    order: { ...order, ...overrides },
    items: [{ name: "Ёлка", quantity: 1 }],
    to,
    siteUrl: "https://stariva.ru/",
  });

test("writes about a deposit with the amount and the order link", () => {
  const email = send({});
  if (!email) throw new Error("expected an email");
  expect(email.to).toEqual(["b@x.test"]);
  expect(email.subject).toBe(
    "Заказ №1042 согласован: внесите предоплату — Stariva",
  );
  expect(email.props.orderUrl).toBe("https://stariva.ru/order/order-1");
  expect(email.props.paymentDueLabel).toBe("16 октября");
  // Новое одобрение после возврата на согласование — новое письмо
  expect(email.idempotencyKey).toBe(
    `order:order-1:awaiting_deposit:${approvedAt.getTime()}`,
  );
});

test("skips service statuses and buyers without email", () => {
  expect(send({ status: "fulfilling" })).toBeNull();
  expect(send({ status: "pending" })).toBeNull();
  expect(send({}, null)).toBeNull();
});
