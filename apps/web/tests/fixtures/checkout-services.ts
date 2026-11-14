import { expect, mock } from "bun:test";
import { OzonDeliveryError } from "../../src/lib/ozon-delivery/errors";

const item = {
  productSlug: "elka",
  ozonSku: 1,
  name: "Ёлка",
  price: 10_000,
  quantity: 1,
};

mock.module("../../src/lib/commerce/catalog", () => ({
  CatalogItemsUnavailableError: class extends Error {
    productSlugs: string[] = [];
  },
  MadeToOrderOptionsError: class extends Error {},
  resolveCatalogItems: async () => [item],
  resolveMadeToOrderItems: async () => [],
}));
const createProductOrder = mock(async (_input: unknown) => ({
  id: "order-1",
  number: 1001,
  amountTotal: 10_000,
}));
mock.module("../../src/lib/commerce/orders", () => ({
  attachPaymentId: async () => {},
  createMadeToOrderOrder: async () => ({}),
  createProductOrder,
}));
mock.module("../../src/lib/commerce/order-notifications", () => ({
  notifyCustomer: async () => {},
  notifyMadeToOrderRequested: async () => {},
}));
mock.module("../../src/lib/commerce/order-services", () => ({
  siteUrl: () => "https://stariva.test",
}));
mock.module("@/lib/campaign-attribution", () => ({
  attributionFromRequest: () => null,
}));
mock.module("@/lib/visitor", () => ({ collectVisitor: async () => null }));
mock.module("@/lib/ozon-delivery/auth", () => ({
  isOzonDeliveryConfigured: () => true,
}));
const checkDeliveryAvailable = mock(async (_phone: string) => ({
  available: true,
}));
const checkout = mock(
  async (
    _request: unknown,
  ): Promise<{
    available: boolean;
    reason?: string;
    deliveryPriceKopecks: number;
    splits: never[];
  }> => ({ available: true, deliveryPriceKopecks: 30_000, splits: [] }),
);
mock.module("@/lib/ozon-delivery/client", () => ({
  checkDeliveryAvailable,
  checkout,
}));
mock.module("@/lib/ozon-delivery/pickup-points-cache", () => ({
  getCachedPickupPointsInfo: async () => ({ points: [], unavailable: [] }),
}));
const createPayment = mock(async (_input: { amountKopecks: number }) => ({
  id: "payment-1",
  confirmation: { confirmation_url: "https://yookassa.test/pay" },
}));
mock.module("@/lib/payments/yookassa", () => ({
  createPayment,
  isYooKassaConfigured: () => true,
}));

const { checkoutServices } = await import(
  "../../src/lib/commerce/checkout-services"
);

const ozonDown = () => new OzonDeliveryError("ozon_delivery_timeout", true);
const ozonRefused = () =>
  new OzonDeliveryError("ozon_delivery_request_failed_400: bad point", false);

const quoteInput = {
  contactPhone: "+7 900 123-45-67",
  items: [{ productSlug: "elka", quantity: 1 }],
  delivery: { method: "pickup" as const, pointId: "123" },
};
const createInput = {
  contactName: "Анна",
  contactPhone: "+7 900 123-45-67",
  contactEmail: "anna@example.com",
  items: [{ productSlug: "elka", quantity: 1 }],
  delivery: {
    method: "pickup" as const,
    pointId: "123",
    pointLabel: "ПВЗ Ozon, Москва, Тверская 1",
  },
  personalDataConsent: true as const,
  offerAccepted: true as const,
  userId: null,
  headers: new Headers(),
};

// Запускается отдельным процессом, чтобы моки не подменяли модули других тестов.
const scenario = process.argv[2];
async function test(name: string, run: () => Promise<void>) {
  if (name === scenario) await run();
}

await test("phone check is skipped when Ozon is down", async () => {
  checkDeliveryAvailable.mockRejectedValueOnce(ozonDown());
  expect(await checkoutServices.checkPhone("+7 900 123-45-67")).toEqual({
    status: "ok",
    check: { available: true },
  });
});

await test("phone check still fails on an Ozon refusal", async () => {
  checkDeliveryAvailable.mockRejectedValueOnce(ozonRefused());
  expect(await checkoutServices.checkPhone("+7 900 123-45-67")).toEqual({
    status: "check_failed",
  });
});

await test("quote falls back to free manual delivery when Ozon is down", async () => {
  checkout.mockRejectedValueOnce(ozonDown());
  expect(await checkoutServices.quote(quoteInput)).toEqual({
    status: "ok",
    quote: {
      available: true,
      deliveryPriceKopecks: 0,
      shipments: [],
      manual: true,
    },
  });
});

await test("quote reports an Ozon refusal instead of going manual", async () => {
  checkout.mockRejectedValueOnce(ozonRefused());
  expect(await checkoutServices.quote(quoteInput)).toEqual({
    status: "check_failed",
  });
});

await test("create takes the order with manual delivery when Ozon is down", async () => {
  checkout.mockRejectedValueOnce(ozonDown());
  const result = await checkoutServices.create(createInput);
  expect(result.status).toBe("ok");
  const [order] = createProductOrder.mock.calls[0] as [
    { checkout: unknown; pointLabel?: string },
  ];
  // Без расчёта Ozon: доставка бесплатна, адрес для мастера — от покупателя
  expect(order.checkout).toBeNull();
  expect(order.pointLabel).toBe("ПВЗ Ozon, Москва, Тверская 1");
  expect(createPayment).toHaveBeenCalledTimes(1);
});

await test("create refuses to charge more delivery than the buyer saw", async () => {
  // Покупатель видел «бесплатно» (Ozon лежал), а теперь Ozon ожил: 300 ₽
  const result = await checkoutServices.create({
    ...createInput,
    expectedDeliveryKopecks: 0,
  });
  expect(result).toEqual({ status: "delivery_price_changed" });
  expect(createProductOrder).not.toHaveBeenCalled();
  expect(createPayment).not.toHaveBeenCalled();
});

await test("create goes ahead when the delivery price matches what the buyer saw", async () => {
  const result = await checkoutServices.create({
    ...createInput,
    expectedDeliveryKopecks: 30_000,
  });
  expect(result.status).toBe("ok");
  const [order] = createProductOrder.mock.calls[0] as [
    { checkout: { deliveryPriceKopecks: number } },
  ];
  expect(order.checkout.deliveryPriceKopecks).toBe(30_000);
});

await test("create stays free when Ozon is down and the buyer expected a price", async () => {
  checkout.mockRejectedValueOnce(ozonDown());
  const result = await checkoutServices.create({
    ...createInput,
    expectedDeliveryKopecks: 30_000,
  });
  expect(result.status).toBe("ok");
});

await test("create refuses a manual order that has no address for the point", async () => {
  checkout.mockRejectedValueOnce(ozonDown());
  // Старая вкладка: подписи пункта нет, а Ozon адрес подсказать не может
  const { pointLabel: _, ...delivery } = createInput.delivery;
  expect(await checkoutServices.create({ ...createInput, delivery })).toEqual({
    status: "check_failed",
  });
  checkout.mockRejectedValueOnce(ozonDown());
  expect(
    await checkoutServices.create({
      ...createInput,
      delivery: { ...delivery, pointLabel: "   " },
    }),
  ).toEqual({ status: "check_failed" });
  expect(createProductOrder).not.toHaveBeenCalled();
});

await test("create reports delivery_unavailable when Ozon says no", async () => {
  checkout.mockResolvedValueOnce({
    available: false,
    reason: "Нет доставки",
    deliveryPriceKopecks: 0,
    splits: [],
  });
  expect(await checkoutServices.create(createInput)).toEqual({
    status: "delivery_unavailable",
  });
  expect(createProductOrder).not.toHaveBeenCalled();
});

await test("create does not go manual on an Ozon refusal", async () => {
  checkout.mockRejectedValueOnce(ozonRefused());
  expect(await checkoutServices.create(createInput)).toEqual({
    status: "check_failed",
  });
  expect(createProductOrder).not.toHaveBeenCalled();
});
