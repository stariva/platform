import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  isDeliveryQuoteRequiredToPay,
  isPaymentOverdue,
  madeToOrderPaymentStep,
  madeToOrderReceiptLines,
  needsDeliveryQuote,
  paymentOutcome,
} from "./made-to-order-flow";

test("the balance receipt shows delivery on its own line", () => {
  assert.deepEqual(
    madeToOrderReceiptLines("Ёлка", { type: "balance", amount: 240000 }, 45000),
    [
      { name: "Ёлка, доплата", amount: 195000, quantity: 1 },
      { name: "Доставка", amount: 45000, quantity: 1 },
    ],
  );
});

test("the deposit and a balance without delivery take one receipt line", () => {
  assert.deepEqual(
    madeToOrderReceiptLines("Ёлка", { type: "deposit", amount: 195000 }, 45000),
    [{ name: "Ёлка, предоплата", amount: 195000, quantity: 1 }],
  );
  assert.deepEqual(
    madeToOrderReceiptLines("Ёлка", { type: "balance", amount: 195000 }, 0),
    [{ name: "Ёлка, доплата", amount: 195000, quantity: 1 }],
  );
});

test("a stale payment smaller than delivery is not split into a negative line", () => {
  assert.deepEqual(
    madeToOrderReceiptLines("Ёлка", { type: "balance", amount: 30000 }, 45000),
    [{ name: "Ёлка, доплата", amount: 30000, quantity: 1 }],
  );
});

const now = new Date("2026-10-03T12:00:00Z");
const later = new Date("2026-10-05T12:00:00Z");
const earlier = new Date("2026-10-01T12:00:00Z");

const approved = {
  kind: "made_to_order" as const,
  status: "awaiting_deposit" as const,
  amountTotal: 845000,
  depositAmount: 400000,
  paymentDueAt: later,
};

test("a request without approval has nothing to pay", () => {
  assert.equal(
    madeToOrderPaymentStep(
      { ...approved, status: "requested", depositAmount: null },
      now,
    ),
    null,
  );
});

test("an approved order asks for the fixed deposit", () => {
  assert.deepEqual(madeToOrderPaymentStep(approved, now), {
    type: "deposit",
    amount: 400000,
  });
});

test("a finished order asks for the rest including delivery", () => {
  assert.deepEqual(
    madeToOrderPaymentStep({ ...approved, status: "awaiting_balance" }, now),
    { type: "balance", amount: 445000 },
  );
});

const parcel = { weightGrams: 800, lengthCm: 60, widthCm: 30, heightCm: 20 };
const finished = { ...approved, status: "awaiting_balance" as const };

test("the balance waits for the delivery to be priced, the deposit never does", () => {
  // Мастер указала посылку, покупатель ещё не выбрал пункт: цены доставки нет
  const unpriced = {
    ...finished,
    checkoutSnapshot: { parcel, priceKopecks: null },
  };
  assert.equal(needsDeliveryQuote(unpriced), true);
  assert.equal(isDeliveryQuoteRequiredToPay(unpriced, now), true);

  // Доставка посчитана — платить можно
  const priced = {
    ...finished,
    checkoutSnapshot: { parcel, priceKopecks: 45000 },
  };
  assert.equal(needsDeliveryQuote(priced), false);
  assert.equal(isDeliveryQuoteRequiredToPay(priced, now), false);

  // Ручная доплата: расчёта нет вовсе, доставку назвала мастер
  const manual = { ...finished, checkoutSnapshot: null };
  assert.equal(needsDeliveryQuote(manual), false);
  assert.equal(isDeliveryQuoteRequiredToPay(manual, now), false);

  // Цена доставки 0 — тоже цена, платить можно
  assert.equal(
    needsDeliveryQuote({
      ...finished,
      checkoutSnapshot: { parcel, priceKopecks: 0 },
    }),
    false,
  );
});

test("the deposit is never held back for a pickup point", () => {
  const deposit = { ...approved, checkoutSnapshot: null };
  assert.equal(needsDeliveryQuote(deposit), false);
  assert.equal(isDeliveryQuoteRequiredToPay(deposit, now), false);
  // Снимок с посылкой в другом статусе не делает заказ «ждущим пункта»
  assert.equal(
    needsDeliveryQuote({
      ...approved,
      status: "in_production",
      checkoutSnapshot: { parcel, priceKopecks: null },
    }),
    false,
  );
});

test("an overdue payment cannot be paid until the master extends it", () => {
  const overdue = { ...approved, paymentDueAt: earlier };
  assert.equal(madeToOrderPaymentStep(overdue, now), null);
  assert.equal(isPaymentOverdue(overdue, now), true);
  assert.equal(isPaymentOverdue(approved, now), false);
});

test("orders in production or stock orders have nothing to pay here", () => {
  assert.equal(
    madeToOrderPaymentStep({ ...approved, status: "in_production" }, now),
    null,
  );
  assert.equal(
    madeToOrderPaymentStep({ ...approved, kind: "stock" }, now),
    null,
  );
});

const deposit = {
  id: "p1",
  type: "deposit" as const,
  status: "succeeded" as const,
  paidAt: earlier,
};

test("a payment that moved the order is applied", () => {
  assert.equal(
    paymentOutcome(
      { depositPaidAt: earlier, paidAt: null },
      [deposit],
      deposit,
    ),
    "applied",
  );
});

test("a second payment for the same stage is a duplicate", () => {
  const second = { ...deposit, id: "p2", paidAt: now };
  const order = { depositPaidAt: earlier, paidAt: null };

  assert.equal(paymentOutcome(order, [deposit, second], second), "duplicate");
  // Первый платёж при этом остаётся зачтённым
  assert.equal(paymentOutcome(order, [deposit, second], deposit), "applied");
});

test("a payment the order did not expect is unexpected", () => {
  const balance = { ...deposit, id: "p3", type: "balance" as const };
  assert.equal(
    paymentOutcome(
      { depositPaidAt: earlier, paidAt: null },
      [balance],
      balance,
    ),
    "unexpected",
  );
});
