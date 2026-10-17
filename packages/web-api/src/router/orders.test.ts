import { expect, test } from "bun:test";
import type { OrderPaymentResult, OrderServices } from "../orpc";

const { safe } = await import("@orpc/client");
const {
  NothingToPayError,
  OrderDetailsLockedError,
  OrderNotFoundError,
  PaymentCreateFailedError,
  PaymentOverdueError,
  PaymentsUnavailableError,
} = await import("../contract");
const { lastStatus, wireClient } = await import("../testing/wire-client");

const orderId = "ord_123";
const phone = "+7 900 123-45-67";

const view = {
  number: 1042,
  kind: "made_to_order" as const,
  status: "awaiting_deposit",
  paid: false,
  amountTotal: 500000,
  amountProducts: 450000,
  amountDelivery: 50000,
  depositAmount: 250000,
  depositPaid: false,
  leadTime: "3 недели",
  paymentDueAt: "2026-10-20T09:00:00.000Z",
  paymentOverdue: false,
  paymentStep: { type: "deposit" as const, amount: 250000 },
  declineReason: null,
  createdAt: "2026-10-10T09:00:00.000Z",
  deliveryMethod: "ozon",
  customerNotes: null,
  deliveryNote: null,
  trackingNumber: null,
  items: [],
  postings: [],
};

function orders(overrides: Partial<OrderServices> = {}): OrderServices {
  return {
    view: async () => view,
    updateDetails: async () => "ok",
    startPayment: async () => ({
      status: "ok",
      confirmationUrl: "https://yookassa.example.test/pay/1",
    }),
    ...overrides,
  };
}

function firstIssue(error: unknown): string | undefined {
  const issues = (error as { data?: { issues?: Array<{ message: string }> } })
    ?.data?.issues;
  return issues?.[0]?.message;
}

test("shows the order to the buyer who knows the phone", async () => {
  const seen: Array<{ orderId: string; phone: string }> = [];
  const client = wireClient({
    services: {
      orders: orders({
        view: async (input) => {
          seen.push(input);
          return view;
        },
      }),
    },
  });
  expect(await client.orders.view({ orderId, phone })).toEqual(view);
  expect(seen).toEqual([{ orderId, phone }]);
});

test("a missing order or a wrong phone looks the same", async () => {
  const client = wireClient({
    services: { orders: orders({ view: async () => null }) },
  });
  const [error] = await safe(client.orders.view({ orderId, phone }));
  expect(error).toBeInstanceOf(OrderNotFoundError);
  expect(lastStatus()).toBe(404);
});

test("asks for a phone before looking up the order", async () => {
  const client = wireClient({ services: { orders: orders() } });
  const [error] = await safe(client.orders.view({ orderId, phone: "12" }));
  expect(error).toMatchObject({ code: "BAD_REQUEST" });
  expect(firstIssue(error)).toBe("Укажите телефон");
});

test("saves details and passes them to the storefront", async () => {
  const saved: unknown[] = [];
  const client = wireClient({
    services: {
      orders: orders({
        updateDetails: async (input) => {
          saved.push(input);
          return "ok";
        },
      }),
    },
  });
  await client.orders.updateDetails({
    orderId,
    phone,
    items: [
      {
        id: "item-1",
        measurements: [{ label: "Талия", value: "64,5" }],
        comment: "Без застёжки",
      },
    ],
    customerNotes: "Подарок",
  });
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ orderId, phone, customerNotes: "Подарок" });
});

test("rejects a measurement that is not a positive number", async () => {
  const client = wireClient({ services: { orders: orders() } });
  const [error] = await safe(
    client.orders.updateDetails({
      orderId,
      phone,
      items: [
        { id: "item-1", measurements: [{ label: "Талия", value: "abc" }] },
      ],
    }),
  );
  expect(error).toMatchObject({ code: "BAD_REQUEST" });
  expect(firstIssue(error)).toBe("Введите положительное число");
});

test("details are locked once the master approved the order", async () => {
  const client = wireClient({
    services: { orders: orders({ updateDetails: async () => "locked" }) },
  });
  const [error] = await safe(
    client.orders.updateDetails({ orderId, phone, items: [] }),
  );
  expect(error).toBeInstanceOf(OrderDetailsLockedError);
  expect(lastStatus()).toBe(409);
});

test("details of a missing order are not found", async () => {
  const client = wireClient({
    services: { orders: orders({ updateDetails: async () => "not_found" }) },
  });
  const [error] = await safe(
    client.orders.updateDetails({ orderId, phone, items: [] }),
  );
  expect(error).toBeInstanceOf(OrderNotFoundError);
});

test("payment hands out the confirmation link", async () => {
  const calls: unknown[] = [];
  const client = wireClient({
    services: {
      orders: orders({
        startPayment: async (input) => {
          calls.push({ ...input, headers: undefined });
          return {
            status: "ok",
            confirmationUrl: "https://pay.example.test/1",
          };
        },
      }),
    },
  });
  expect(
    await client.orders.pay({
      orderId,
      phone,
      offerAccepted: true,
      returnTo: "account",
    }),
  ).toEqual({ confirmationUrl: "https://pay.example.test/1" });
  expect(calls).toEqual([
    { orderId, phone, returnTo: "account", headers: undefined },
  ]);
});

test("payment needs the offer accepted", async () => {
  const client = wireClient({ services: { orders: orders() } });
  const [error] = await safe(
    client.orders.pay({ orderId, phone, offerAccepted: false as true }),
  );
  expect(error).toMatchObject({ code: "BAD_REQUEST" });
  expect(firstIssue(error)).toBe("Подтвердите согласие с офертой");
});

const failures: Array<
  [Exclude<OrderPaymentResult["status"], "ok">, unknown, number]
> = [
  ["not_found", OrderNotFoundError, 404],
  ["unavailable", PaymentsUnavailableError, 503],
  ["nothing_to_pay", NothingToPayError, 409],
  ["overdue", PaymentOverdueError, 409],
  ["failed", PaymentCreateFailedError, 502],
];

for (const [status, ErrorClass, httpStatus] of failures) {
  test(`payment ${status} is a typed error with status ${httpStatus}`, async () => {
    const client = wireClient({
      services: {
        orders: orders({ startPayment: async () => ({ status }) }),
      },
    });
    const [error] = await safe(
      client.orders.pay({ orderId, phone, offerAccepted: true }),
    );
    expect(error).toBeInstanceOf(ErrorClass as typeof Error);
    expect(lastStatus()).toBe(httpStatus);
  });
}
