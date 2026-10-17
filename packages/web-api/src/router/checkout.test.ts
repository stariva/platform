import { expect, test } from "bun:test";
import type { Session } from "@stariva/auth";
import type { CheckoutServices } from "../orpc";

const { safe } = await import("@orpc/client");
const {
  CheckoutCheckFailedError,
  DeliveryNotAvailableError,
  DeliveryUnavailableError,
  ItemsUnavailableError,
  OptionsUnavailableError,
  PaymentCreateFailedError,
  PaymentsUnavailableError,
} = await import("../contract");
const { lastStatus, wireClient } = await import("../testing/wire-client");

const createdOrder = {
  confirmationUrl: "https://yookassa.example.test/pay/1",
  orderId: "ord_1",
  orderNumber: 1042,
  analytics: {
    id: "ord_1",
    revenue: 3500,
    products: [{ id: "elka", name: "Ёлка", price: 3000, quantity: 1 }],
  },
};

const quote = {
  available: true,
  deliveryPriceKopecks: 25000,
  shipments: [{ dateFrom: "2026-10-20", dateTo: "2026-10-22" }],
};

const createInput = {
  contactName: "Анна",
  contactPhone: "+7 900 123-45-67",
  items: [{ productSlug: "elka", quantity: 1 }],
  delivery: { method: "pickup" as const, pointId: "123" },
  personalDataConsent: true as const,
  offerAccepted: true as const,
};

const madeToOrderInput = {
  contactName: "Анна",
  contactPhone: "+7 900 123-45-67",
  items: [
    {
      productSlug: "korzina",
      quantity: 1,
      options: { size: "M", color: "Бежевый" },
    },
  ],
  personalDataConsent: true as const,
};

function checkout(overrides: Partial<CheckoutServices> = {}): CheckoutServices {
  return {
    checkPhone: async () => ({ status: "ok", check: { available: true } }),
    quote: async () => ({ status: "ok", quote }),
    create: async () => ({ status: "ok", order: createdOrder }),
    requestMadeToOrder: async () => ({
      status: "ok",
      request: { orderId: "ord_2", estimate: 4500 },
    }),
    ...overrides,
  };
}

function firstIssue(error: unknown): string | undefined {
  const issues = (error as { data?: { issues?: Array<{ message: string }> } })
    ?.data?.issues;
  return issues?.[0]?.message;
}

const session = { user: { id: "user_1" } } as Session;

test("checks the phone against Ozon Delivery", async () => {
  const seen: string[] = [];
  const client = wireClient({
    services: {
      checkout: checkout({
        checkPhone: async (phone) => {
          seen.push(phone);
          return { status: "ok", check: { available: false, reason: "Нет" } };
        },
      }),
    },
  });
  expect(
    await client.checkout.checkPhone({ phone: "+7 900 123-45-67" }),
  ).toEqual({ available: false, reason: "Нет" });
  expect(seen).toEqual(["+7 900 123-45-67"]);
});

test("asks for a phone before calling Ozon", async () => {
  const client = wireClient({ services: { checkout: checkout() } });
  const [error] = await safe(client.checkout.checkPhone({ phone: "12" }));
  expect(error).toMatchObject({ code: "BAD_REQUEST" });
  expect(firstIssue(error)).toBe("Укажите телефон");
});

test("reports missing Ozon keys and Ozon failures differently", async () => {
  const unconfigured = wireClient({
    services: {
      checkout: checkout({
        checkPhone: async () => ({ status: "unconfigured" }),
      }),
    },
  });
  const [missing] = await safe(
    unconfigured.checkout.checkPhone({ phone: "+7 900 123-45-67" }),
  );
  expect(missing).toBeInstanceOf(DeliveryUnavailableError);
  expect(lastStatus()).toBe(503);

  const failing = wireClient({
    services: {
      checkout: checkout({
        checkPhone: async () => ({ status: "check_failed" }),
      }),
    },
  });
  const [failed] = await safe(
    failing.checkout.checkPhone({ phone: "+7 900 123-45-67" }),
  );
  expect(failed).toBeInstanceOf(CheckoutCheckFailedError);
  expect((failed as Error).message).toBe(
    "Не удалось проверить доступность доставки",
  );
  expect(lastStatus()).toBe(502);
});

test("quotes the delivery to the chosen point", async () => {
  const client = wireClient({ services: { checkout: checkout() } });
  expect(
    await client.checkout.quote({
      contactPhone: "+7 900 123-45-67",
      items: [{ productSlug: "elka", quantity: 1 }],
      delivery: { method: "pickup", pointId: "123" },
    }),
  ).toEqual(quote);
});

test("quote tells which items are gone with a 409", async () => {
  const client = wireClient({
    services: {
      checkout: checkout({
        quote: async () => ({
          status: "items_unavailable",
          unavailableProductSlugs: ["elka"],
        }),
      }),
    },
  });
  const [error] = await safe(
    client.checkout.quote({
      contactPhone: "+7 900 123-45-67",
      items: [{ productSlug: "elka", quantity: 1 }],
      delivery: { method: "pickup", pointId: "123" },
    }),
  );
  expect(error).toBeInstanceOf(ItemsUnavailableError);
  expect((error as ItemsUnavailableError).data).toEqual({
    unavailableProductSlugs: ["elka"],
  });
  expect(lastStatus()).toBe(409);
});

test("rejects an empty cart and a courier delivery", async () => {
  const client = wireClient({ services: { checkout: checkout() } });
  const [empty] = await safe(
    client.checkout.quote({
      contactPhone: "+7 900 123-45-67",
      items: [],
      delivery: { method: "pickup", pointId: "123" },
    }),
  );
  expect(empty).toMatchObject({ code: "BAD_REQUEST" });
  const [courier] = await safe(
    client.checkout.quote({
      contactPhone: "+7 900 123-45-67",
      items: [{ productSlug: "elka", quantity: 1 }],
      // @ts-expect-error курьерской доставки в контракте нет
      delivery: { method: "courier", address: "Москва" },
    }),
  );
  expect(courier).toMatchObject({ code: "BAD_REQUEST" });
});

test("creates the order for a guest and returns the payment link", async () => {
  const seen: Array<{ userId: string | null; hasHeaders: boolean }> = [];
  const client = wireClient({
    services: {
      checkout: checkout({
        create: async (input) => {
          seen.push({
            userId: input.userId,
            hasHeaders: input.headers instanceof Headers,
          });
          return { status: "ok", order: createdOrder };
        },
      }),
    },
  });
  expect(await client.checkout.create(createInput)).toEqual(createdOrder);
  expect(seen).toEqual([{ userId: null, hasHeaders: true }]);
});

test("links the order to the signed-in buyer", async () => {
  const seen: Array<string | null> = [];
  const client = wireClient({
    session,
    services: {
      checkout: checkout({
        create: async (input) => {
          seen.push(input.userId);
          return { status: "ok", order: createdOrder };
        },
      }),
    },
  });
  await client.checkout.create(createInput);
  expect(seen).toEqual(["user_1"]);
});

test("needs the consents before creating an order", async () => {
  const client = wireClient({ services: { checkout: checkout() } });
  const [noPd] = await safe(
    client.checkout.create({
      ...createInput,
      // @ts-expect-error согласие обязательно
      personalDataConsent: false,
    }),
  );
  expect(noPd).toMatchObject({ code: "BAD_REQUEST" });
  expect(firstIssue(noPd)).toBe(
    "Нужно согласие на обработку персональных данных",
  );
  const [noOffer] = await safe(
    client.checkout.create({
      ...createInput,
      // @ts-expect-error акцепт оферты обязателен
      offerAccepted: false,
    }),
  );
  expect(firstIssue(noOffer)).toBe("Подтвердите согласие с офертой");
});

test("maps every create failure to its own error", async () => {
  const cases = [
    [{ status: "unconfigured" }, PaymentsUnavailableError, 503],
    [{ status: "check_failed" }, CheckoutCheckFailedError, 502],
    [{ status: "delivery_unavailable" }, DeliveryNotAvailableError, 400],
    [{ status: "payment_failed" }, PaymentCreateFailedError, 502],
    [
      { status: "items_unavailable", unavailableProductSlugs: ["elka"] },
      ItemsUnavailableError,
      409,
    ],
  ] as const;
  for (const [result, ErrorClass, status] of cases) {
    const client = wireClient({
      services: { checkout: checkout({ create: async () => result }) },
    });
    const [error] = await safe(client.checkout.create(createInput));
    expect(error).toBeInstanceOf(ErrorClass);
    expect(lastStatus()).toBe(status);
  }
});

test("takes a made-to-order request without payment", async () => {
  const seen: Array<{ userId: string | null }> = [];
  const client = wireClient({
    session,
    services: {
      checkout: checkout({
        requestMadeToOrder: async (input) => {
          seen.push({ userId: input.userId });
          return {
            status: "ok",
            request: { orderId: "ord_2", estimate: 4500 },
          };
        },
      }),
    },
  });
  expect(await client.checkout.requestMadeToOrder(madeToOrderInput)).toEqual({
    orderId: "ord_2",
    estimate: 4500,
  });
  expect(seen).toEqual([{ userId: "user_1" }]);
});

test("made-to-order failures keep their own texts", async () => {
  const options = wireClient({
    services: {
      checkout: checkout({
        requestMadeToOrder: async () => ({ status: "options_unavailable" }),
      }),
    },
  });
  const [badOptions] = await safe(
    options.checkout.requestMadeToOrder(madeToOrderInput),
  );
  expect(badOptions).toBeInstanceOf(OptionsUnavailableError);
  expect(lastStatus()).toBe(400);

  const failing = wireClient({
    services: {
      checkout: checkout({
        requestMadeToOrder: async () => ({ status: "check_failed" }),
      }),
    },
  });
  const [failed] = await safe(
    failing.checkout.requestMadeToOrder(madeToOrderInput),
  );
  expect(failed).toBeInstanceOf(CheckoutCheckFailedError);
  expect((failed as Error).message).toBe("Не удалось проверить заявку");
});

test("made-to-order limits the size and colour to a short text", async () => {
  const client = wireClient({ services: { checkout: checkout() } });
  const [error] = await safe(
    client.checkout.requestMadeToOrder({
      ...madeToOrderInput,
      items: [
        {
          productSlug: "korzina",
          quantity: 1,
          options: { size: "   ", color: "Бежевый" },
        },
      ],
    }),
  );
  expect(error).toMatchObject({ code: "BAD_REQUEST" });
});
