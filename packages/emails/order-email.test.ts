import { expect, test } from "bun:test";

import { buildOrderStatusEmail } from "./order-email";

const approvedAt = new Date("2026-10-13T09:00:00Z");
const order = {
  id: "order-1",
  number: 1042,
  status: "awaiting_deposit",
  amountTotal: 640000,
  amountDelivery: 40000,
  depositAmount: 300000,
  leadTime: "2–3 недели",
  paymentDueAt: new Date("2026-10-16T09:00:00Z"),
  approvedAt,
  trackingNumber: null,
  declineReason: null,
  checkoutSnapshot: null as unknown,
};
const send = (
  overrides: Partial<typeof order>,
  to: string | null = "b@x.test",
) =>
  buildOrderStatusEmail({
    order: { ...order, ...overrides },
    items: [{ name: "Ёлка", quantity: 1, image: null }],
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

test("the deposit letter does not ask for a pickup point", () => {
  const email = send({});
  expect(email?.props.deliveryQuoteNeeded).toBe(false);
  expect(email?.props.status).toBe("awaiting_deposit");
});

test("a finished product asks to pick a pickup point only while the delivery is not priced", () => {
  const parcel = { weightGrams: 800, lengthCm: 60, widthCm: 30, heightCm: 20 };
  const finished = { status: "awaiting_balance", amountDelivery: 0 };

  // Мастер указала посылку, покупатель ещё не выбрал пункт
  expect(
    send({ ...finished, checkoutSnapshot: { parcel, priceKopecks: null } })
      ?.props.deliveryQuoteNeeded,
  ).toBe(true);
  // Доставка посчитана — просим только оплатить
  expect(
    send({ ...finished, checkoutSnapshot: { parcel, priceKopecks: 45000 } })
      ?.props.deliveryQuoteNeeded,
  ).toBe(false);
  // Ручная доплата: расчёта нет вовсе, доставка названа мастером
  expect(
    send({ ...finished, amountDelivery: 45000 })?.props.deliveryQuoteNeeded,
  ).toBe(false);
  // Другой статус с тем же снимком — не повод просить пункт
  expect(
    send({ checkoutSnapshot: { parcel, priceKopecks: null } })?.props
      .deliveryQuoteNeeded,
  ).toBe(false);
});

test("a balance billed again with other delivery is a new letter", () => {
  const first = send({ status: "awaiting_balance", amountTotal: 435000 });
  const second = send({ status: "awaiting_balance", amountTotal: 470000 });
  const same = send({ status: "awaiting_balance", amountTotal: 435000 });

  // Тот же счёт при повторе webhook не дублируется, другой — уходит заново
  expect(first?.idempotencyKey).toBe(same?.idempotencyKey);
  expect(first?.idempotencyKey).not.toBe(second?.idempotencyKey);
  expect(first?.idempotencyKey).toContain(":435000");
});

test("skips service statuses and buyers without email", () => {
  expect(send({ status: "fulfilling" })).toBeNull();
  expect(send({ status: "pending" })).toBeNull();
  expect(send({}, null)).toBeNull();
});
