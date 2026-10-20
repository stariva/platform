import { expect, test } from "bun:test";

import { receiptsExpected, workshopReceiptsExpected } from "./summary";

const paid = new Date("2026-10-15T09:00:00Z");
const order = {
  kind: "made_to_order" as const,
  status: "in_production",
  paidAt: null as Date | null,
  depositPaidAt: null as Date | null,
  succeededPayments: 0,
};

test("an unpaid order needs no receipt", () => {
  expect(receiptsExpected(order)).toBe(0);
  expect(workshopReceiptsExpected({ status: "pending", paymentId: "p1" })).toBe(
    0,
  );
});

test("made-to-order needs a receipt for the deposit and another for the balance", () => {
  const deposit = { ...order, depositPaidAt: paid, succeededPayments: 1 };
  expect(receiptsExpected(deposit)).toBe(1);
  const full = {
    ...deposit,
    status: "ready_to_ship",
    paidAt: paid,
    succeededPayments: 2,
  };
  expect(receiptsExpected(full)).toBe(2);
});

test("an order paid before payment rows existed still needs one receipt", () => {
  expect(receiptsExpected({ ...order, paidAt: paid })).toBe(1);
});

test("a ready-made item is paid once, whatever the payment rows say", () => {
  expect(
    receiptsExpected({
      ...order,
      kind: "stock",
      status: "paid",
      paidAt: paid,
      succeededPayments: 0,
    }),
  ).toBe(1);
});

test("canceled and refunded orders need no receipt", () => {
  for (const status of ["canceled", "refunded"]) {
    expect(
      receiptsExpected({
        ...order,
        status,
        paidAt: paid,
        succeededPayments: 2,
      }),
    ).toBe(0);
  }
  expect(
    workshopReceiptsExpected({ status: "refunded", paymentId: "p1" }),
  ).toBe(0);
  expect(workshopReceiptsExpected({ status: "paid", paymentId: "p1" })).toBe(1);
});

test("a course opened with a marketplace code needs no receipt on the site", () => {
  expect(workshopReceiptsExpected({ status: "paid", paymentId: null })).toBe(0);
});
