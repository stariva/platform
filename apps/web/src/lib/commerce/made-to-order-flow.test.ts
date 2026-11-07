import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  isDeliveryPointRequiredToPay,
  isPaymentOverdue,
  madeToOrderPaymentStep,
  madeToOrderReceiptLines,
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

test("the deposit waits for a pickup point, the balance does not", () => {
  const nowhere = { ...approved, deliveryPointId: null, deliveryNote: null };
  assert.equal(isDeliveryPointRequiredToPay(nowhere, now), true);
  assert.equal(
    isDeliveryPointRequiredToPay({ ...nowhere, deliveryPointId: "77" }, now),
    false,
  );
  // Старая заявка с адресом текстом вместо пункта
  assert.equal(
    isDeliveryPointRequiredToPay(
      { ...nowhere, deliveryNote: "Казань, СДЭК" },
      now,
    ),
    false,
  );
  assert.equal(
    isDeliveryPointRequiredToPay(
      { ...nowhere, status: "awaiting_balance" },
      now,
    ),
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
