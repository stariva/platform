import { expect, test } from "bun:test";
import type { Session } from "@stariva/auth";
import type { CheckoutServices } from "../orpc";

const { safe } = await import("@orpc/client");
const {
  CheckoutCheckFailedError,
  DeliveryNotAvailableError,
  DeliveryPriceChangedError,
  DeliveryUnavailableError,
  ItemsUnavailableError,
  MinimumOrderNotMetError,
  normalizeTelegramHandle,
  OptionsUnavailableError,
  PaymentCreateFailedError,
  PaymentsUnavailableError,
  OrderTotalChangedError,
  ProductsPriceChangedError,
  PromoCodeInvalidError,
  TELEGRAM_HANDLE_ERROR,
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
  contactEmail: "anna@example.com",
  items: [{ productSlug: "elka", quantity: 1 }],
  delivery: { method: "pickup" as const, pointId: "123" },
  personalDataConsent: true as const,
  offerAccepted: true as const,
};

const instantCreateInput = { ...createInput, expectedTotalKopecks: 255000 };

const madeToOrderInput = {
  contactName: "Анна",
  contactPhone: "+7 900 123-45-67",
  contactEmail: "anna@example.com",
  deliveryPointId: "1234",
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
    checkInstantMadeToOrderPhone: async () => ({
      status: "ok",
      check: { available: true },
    }),
    quoteInstantMadeToOrder: async () => ({
      status: "ok",
      quote: { available: true, deliveryPriceKopecks: 25000 },
    }),
    validateInstantMadeToOrderPromo: async () => ({
      status: "ok",
      validation: {
        valid: true,
        reason: null,
        code: "NEWYEAR",
        discountType: "percent" as const,
        discountValue: 10,
        discountKopecks: 10_000,
        productsKopecks: 100_000,
      },
    }),
    createInstantMadeToOrder: async () => ({
      status: "ok",
      order: createdOrder,
    }),
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

test("asks for a full phone before calling Ozon", async () => {
  let calls = 0;
  const client = wireClient({
    services: {
      checkout: checkout({
        checkPhone: async () => {
          calls += 1;
          return { status: "ok", check: { available: true } };
        },
      }),
    },
  });
  // Слишком короткий, неполный (+7 и код) и с лишним текстом вместо цифр
  for (const phone of ["12", "+7 900", "+7 (900) 12", "телефон"]) {
    const [error] = await safe(client.checkout.checkPhone({ phone }));
    expect(error).toMatchObject({ code: "BAD_REQUEST" });
    expect(firstIssue(error)).toBe("Укажите телефон полностью");
  }
  expect(calls).toBe(0);

  expect(
    await client.checkout.checkPhone({ phone: "8 (900) 123-45-67" }),
  ).toEqual({ available: true });
  expect(calls).toBe(1);
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

test("quote passes a manual (Ozon unavailable) delivery through", async () => {
  const manual = {
    available: true,
    deliveryPriceKopecks: 0,
    shipments: [],
    manual: true,
  };
  const client = wireClient({
    services: {
      checkout: checkout({
        quote: async () => ({ status: "ok", quote: manual }),
      }),
    },
  });
  expect(
    await client.checkout.quote({
      contactPhone: "+7 900 123-45-67",
      items: [{ productSlug: "elka", quantity: 1 }],
      delivery: { method: "pickup", pointId: "123" },
    }),
  ).toEqual(manual);
});

test("create hands the expected delivery price and point label to the service", async () => {
  const seen: unknown[] = [];
  const client = wireClient({
    services: {
      checkout: checkout({
        create: async (input) => {
          seen.push([input.expectedDeliveryKopecks, input.delivery]);
          return { status: "ok", order: createdOrder };
        },
      }),
    },
  });
  await client.checkout.create({
    ...createInput,
    delivery: { ...createInput.delivery, pointLabel: "ПВЗ, Москва" },
    expectedDeliveryKopecks: 0,
  });
  expect(seen).toEqual([
    [0, { method: "pickup", pointId: "123", pointLabel: "ПВЗ, Москва" }],
  ]);
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
    [{ status: "delivery_price_changed" }, DeliveryPriceChangedError, 409],
    [{ status: "products_price_changed" }, ProductsPriceChangedError, 409],
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

test("an order needs a valid email for the receipt and status updates", async () => {
  const client = wireClient({ services: { checkout: checkout() } });
  const { contactEmail: _, ...withoutEmail } = createInput;
  const [missing] = await safe(
    // @ts-expect-error email обязателен в контракте
    client.checkout.create(withoutEmail),
  );
  expect(missing).toMatchObject({ code: "BAD_REQUEST" });
  expect(firstIssue(missing)).toBe("Укажите email");
  const [invalid] = await safe(
    client.checkout.create({ ...createInput, contactEmail: "anna" }),
  );
  expect(invalid).toMatchObject({ code: "BAD_REQUEST" });
});

test("made-to-order accepts legacy phone and current email requests over RPC", async () => {
  const seen: unknown[] = [];
  const client = wireClient({
    services: {
      checkout: checkout({
        requestMadeToOrder: async (input) => {
          seen.push(input);
          return {
            status: "ok",
            request: { orderId: "ord_2", estimate: 4500 },
          };
        },
      }),
    },
  });
  for (const preferredContactChannel of ["phone", "email"] as const) {
    const input = { ...madeToOrderInput, preferredContactChannel };
    expect(await client.checkout.requestMadeToOrder(input)).toEqual({
      orderId: "ord_2",
      estimate: 4500,
    });
    expect(seen.at(-1)).toMatchObject(input);
  }
});

test("made-to-order asks for a Telegram handle when Telegram is chosen", async () => {
  const client = wireClient({ services: { checkout: checkout() } });
  const [missing] = await safe(
    client.checkout.requestMadeToOrder({
      ...madeToOrderInput,
      preferredContactChannel: "telegram",
    }),
  );
  expect(missing).toMatchObject({ code: "BAD_REQUEST" });
  expect(firstIssue(missing)).toBe(TELEGRAM_HANDLE_ERROR);

  const [invalid] = await safe(
    client.checkout.requestMadeToOrder({
      ...madeToOrderInput,
      preferredContactChannel: "telegram",
      contactMessenger: "https://t.me/StarivaBot?start=abc",
    }),
  );
  expect(invalid).toMatchObject({ code: "BAD_REQUEST" });
});

test("telegram handle accepts a link, @nick or nick", () => {
  expect(normalizeTelegramHandle("@anna_star")).toBe("@anna_star");
  expect(normalizeTelegramHandle("anna_star")).toBe("@anna_star");
  expect(normalizeTelegramHandle("t.me/anna_star")).toBe("@anna_star");
  expect(normalizeTelegramHandle("https://t.me/anna_star")).toBe("@anna_star");
  expect(normalizeTelegramHandle("+7 900 123-45-67")).toBeNull();
});

test("made-to-order requires an email", async () => {
  const client = wireClient({ services: { checkout: checkout() } });
  const { contactEmail: _, ...withoutEmail } = madeToOrderInput;
  const [error] = await safe(
    // @ts-expect-error email обязателен в контракте
    client.checkout.requestMadeToOrder(withoutEmail),
  );
  expect(error).toMatchObject({ code: "BAD_REQUEST" });
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

test("instant made-to-order checkout uses its own quote and create services", async () => {
  const seen: string[] = [];
  const instantQuote = { available: true, deliveryPriceKopecks: 15000 };
  const client = wireClient({
    services: {
      checkout: checkout({
        quoteInstantMadeToOrder: async (input) => {
          seen.push(`quote:${input.delivery.pointId}`);
          return { status: "ok", quote: instantQuote };
        },
        createInstantMadeToOrder: async (input) => {
          seen.push(
            `create:${input.expectedDeliveryKopecks}:${input.expectedProductsKopecks}:${input.expectedTotalKopecks}`,
          );
          return { status: "ok", order: createdOrder };
        },
      }),
    },
  });

  expect(
    await client.checkout.quoteInstantMadeToOrder({
      contactPhone: "+7 900 123-45-67",
      items: [{ productSlug: "shar", quantity: 2 }],
      delivery: { method: "pickup", pointId: "123" },
    }),
  ).toEqual(instantQuote);
  expect(
    await client.checkout.createInstantMadeToOrder({
      ...instantCreateInput,
      items: [{ productSlug: "shar", quantity: 2 }],
      expectedDeliveryKopecks: 15000,
      expectedProductsKopecks: 240000,
    }),
  ).toEqual(createdOrder);
  expect(seen).toEqual(["quote:123", "create:15000:240000:255000"]);
});

test("instant made-to-order create maps price changes and unavailable items", async () => {
  const priceChanged = wireClient({
    services: {
      checkout: checkout({
        createInstantMadeToOrder: async () => ({
          status: "delivery_price_changed",
        }),
      }),
    },
  });
  const [priceError] = await safe(
    priceChanged.checkout.createInstantMadeToOrder(instantCreateInput),
  );
  expect(priceError).toBeInstanceOf(DeliveryPriceChangedError);
  expect(lastStatus()).toBe(409);

  const unavailable = wireClient({
    services: {
      checkout: checkout({
        createInstantMadeToOrder: async () => ({
          status: "items_unavailable",
          unavailableProductSlugs: ["shar"],
        }),
      }),
    },
  });
  const [itemsError] = await safe(
    unavailable.checkout.createInstantMadeToOrder(instantCreateInput),
  );
  expect(itemsError).toBeInstanceOf(ItemsUnavailableError);
  expect((itemsError as ItemsUnavailableError).data).toEqual({
    unavailableProductSlugs: ["shar"],
  });
});

test("instant create rejects a changed total with a conflict", async () => {
  const client = wireClient({
    services: {
      checkout: checkout({
        createInstantMadeToOrder: async () => ({
          status: "order_total_changed",
        }),
      }),
    },
  });
  const [error] = await safe(
    client.checkout.createInstantMadeToOrder(instantCreateInput),
  );
  expect(error).toBeInstanceOf(OrderTotalChangedError);
  expect(lastStatus()).toBe(409);
});

test("instant made-to-order maps the minimum-order rejection", async () => {
  const client = wireClient({
    services: {
      checkout: checkout({
        quoteInstantMadeToOrder: async () => ({
          status: "minimum_order_not_met",
          minimum: 7,
          quantity: 3,
        }),
        createInstantMadeToOrder: async () => ({
          status: "minimum_order_not_met",
          minimum: 7,
          quantity: 3,
        }),
      }),
    },
  });

  const [quoteError] = await safe(
    client.checkout.quoteInstantMadeToOrder({
      contactPhone: "+7 900 123-45-67",
      items: [{ productSlug: "shar", quantity: 3 }],
      delivery: { method: "pickup", pointId: "123" },
    }),
  );
  expect(quoteError).toBeInstanceOf(MinimumOrderNotMetError);
  expect((quoteError as MinimumOrderNotMetError).data).toEqual({
    minimum: 7,
    quantity: 3,
  });

  const [createError] = await safe(
    client.checkout.createInstantMadeToOrder(instantCreateInput),
  );
  expect(createError).toBeInstanceOf(MinimumOrderNotMetError);
});

test("validates an instant-order promo and hands the cart to the service", async () => {
  const seen: unknown[] = [];
  const validation = {
    valid: true,
    reason: null,
    code: "NEWYEAR",
    discountType: "percent" as const,
    discountValue: 10,
    discountKopecks: 10_000,
    productsKopecks: 100_000,
  };
  const client = wireClient({
    services: {
      checkout: checkout({
        validateInstantMadeToOrderPromo: async (input) => {
          seen.push(input);
          return { status: "ok", validation };
        },
      }),
    },
  });

  const input = {
    code: "newyear",
    items: [{ productSlug: "shar", quantity: 2 }],
  };
  expect(await client.checkout.validateInstantMadeToOrderPromo(input)).toEqual(
    validation,
  );
  expect(seen).toEqual([input]);
});

test("instant promo validation maps catalog and service failures", async () => {
  const unavailable = wireClient({
    services: {
      checkout: checkout({
        validateInstantMadeToOrderPromo: async () => ({
          status: "items_unavailable",
          unavailableProductSlugs: ["shar"],
        }),
      }),
    },
  });
  const [itemsError] = await safe(
    unavailable.checkout.validateInstantMadeToOrderPromo({
      code: "NEWYEAR",
      items: [{ productSlug: "shar", quantity: 2 }],
    }),
  );
  expect(itemsError).toBeInstanceOf(ItemsUnavailableError);
  expect(lastStatus()).toBe(409);

  const failing = wireClient({
    services: {
      checkout: checkout({
        validateInstantMadeToOrderPromo: async () => ({
          status: "check_failed",
        }),
      }),
    },
  });
  const [checkError] = await safe(
    failing.checkout.validateInstantMadeToOrderPromo({
      code: "NEWYEAR",
      items: [{ productSlug: "shar", quantity: 2 }],
    }),
  );
  expect(checkError).toBeInstanceOf(CheckoutCheckFailedError);
  expect((checkError as Error).message).toBe("Не удалось проверить промокод");
});

test("instant create passes the promo code and maps its rejection", async () => {
  const seen: Array<string | undefined> = [];
  const ok = wireClient({
    services: {
      checkout: checkout({
        createInstantMadeToOrder: async (input) => {
          seen.push(input.promoCode);
          return { status: "ok", order: createdOrder };
        },
      }),
    },
  });
  await ok.checkout.createInstantMadeToOrder({
    ...instantCreateInput,
    promoCode: "NEWYEAR",
  });
  expect(seen).toEqual(["NEWYEAR"]);

  const invalid = wireClient({
    services: {
      checkout: checkout({
        createInstantMadeToOrder: async () => ({
          status: "promo_code_invalid",
          reason: "Лимит использования промокода исчерпан",
        }),
      }),
    },
  });
  const [error] = await safe(
    invalid.checkout.createInstantMadeToOrder({
      ...instantCreateInput,
      promoCode: "NEWYEAR",
    }),
  );
  expect(error).toBeInstanceOf(PromoCodeInvalidError);
  expect((error as PromoCodeInvalidError).data).toEqual({
    reason: "Лимит использования промокода исчерпан",
  });
  expect(lastStatus()).toBe(400);
});
