import { expect, mock } from "bun:test";

const order = {
  id: "order-1",
  number: 42,
  kind: "made_to_order",
  status: "in_production",
  amountDelivery: 45000,
  deliveryMethod: "pickup" as string,
  deliveryPointId: "77" as string | null,
  contactName: "Анна",
  contactPhone: "+79001234567",
  contactEmail: null,
};
const items = [
  {
    id: "item-1",
    productSlug: "elka",
    name: "Ёлка",
    price: 390000,
    quantity: 1,
    ozonSku: 501 as number | null,
    options: null,
  },
];
const quote = {
  available: true,
  deliveryPriceKopecks: 45000,
  splits: [],
};

const holdMadeToOrderStock = mock(async () => true);
const saveMadeToOrderQuote = mock(async () => {});
const saveOrderCheckoutSnapshot = mock(async () => {});
const getProductOzonSkus = mock(
  async () => new Map<string, number>([["elka", 501]]),
);
const claimMadeToOrderShipment = mock(
  async (): Promise<string | null> => "attempt-1",
);
const attachOzonOrder = mock(async () => {});
const markProductOrderOzonFailed = mock(async () => {});
mock.module("../../src/lib/commerce/orders", () => ({
  getProductOrderById: async () => order,
  getProductOrderItems: async () => items,
  getProductOzonSkus,
  holdMadeToOrderStock,
  saveMadeToOrderQuote,
  saveOrderCheckoutSnapshot,
  claimMadeToOrderShipment,
  attachOzonOrder,
  markProductOrderOzonFailed,
}));
const notifyOzonOrderFailed = mock(async () => {});
const notifyStaffAlert = mock(async () => {});
mock.module("../../src/lib/commerce/order-notifications", () => ({
  notifyOzonOrderFailed,
  notifyStaffAlert,
}));
const pushStockToOzon = mock(async (slugs: string[]) => ({
  updated: ["offer"],
  syncedSlugs: slugs,
  failed: [],
  hidden: [],
}));
mock.module("@stariva/web-api", () => ({
  isOzonSellerConfigured: () => true,
  pushStockToOzon,
}));
mock.module("@/lib/ozon-delivery/auth", () => ({
  isOzonDeliveryConfigured: () => true,
}));
const checkout = mock(async () => quote as typeof quote);
const createOzonDeliveryOrder = mock(async () => ({
  orderId: "ozon-1",
  postingNumbers: ["posting-1"],
}));
mock.module("@/lib/ozon-delivery/client", () => ({
  checkout,
  createOzonDeliveryOrder,
}));
mock.module("@/lib/products", () => ({
  formatPrice: (rubles: number) => `${rubles} ₽`,
}));

const { createMadeToOrderShipment, quoteMadeToOrderDelivery } = await import(
  "../../src/lib/commerce/made-to-order-shipment"
);

// Запускается отдельным процессом, чтобы моки не подменяли модули других тестов.
const scenario = process.argv[2];
async function test(name: string, run: () => Promise<void>) {
  if (name === scenario) await run();
}

await test("the quote holds stock before asking Ozon for a price", async () => {
  const calls: string[] = [];
  holdMadeToOrderStock.mockImplementationOnce(async () => {
    calls.push("hold");
    return true;
  });
  pushStockToOzon.mockImplementationOnce(async (slugs: string[]) => {
    calls.push("push");
    return { updated: [], syncedSlugs: slugs, failed: [], hidden: [] };
  });
  checkout.mockImplementationOnce(async () => {
    calls.push("checkout");
    return quote;
  });

  expect(await quoteMadeToOrderDelivery(order.id)).toEqual({
    available: true,
    deliveryPriceKopecks: 45000,
  });
  expect(calls).toEqual(["hold", "push", "checkout"]);
  expect(checkout).toHaveBeenCalledWith({
    items: [{ sku: 501, quantity: 1 }],
    delivery: { method: "pickup", pointId: "77" },
    buyerPhone: order.contactPhone,
  });
  expect(saveMadeToOrderQuote).toHaveBeenCalledWith(
    order.id,
    quote,
    new Map([["item-1", 501]]),
  );
});

await test("two sizes of one product become one Ozon line", async () => {
  const second = {
    ...items[0],
    id: "item-2",
    quantity: 2,
  } as (typeof items)[0];
  items.push(second);
  await quoteMadeToOrderDelivery(order.id);
  expect(checkout).toHaveBeenCalledWith(
    expect.objectContaining({ items: [{ sku: 501, quantity: 3 }] }),
  );
});

await test("a buyer without a pickup point gets no quote and no stock", async () => {
  order.deliveryPointId = null;
  const result = await quoteMadeToOrderDelivery(order.id);
  expect(result.available).toBe(false);
  expect(result.reason).toContain("пункт выдачи");
  expect(holdMadeToOrderStock).not.toHaveBeenCalled();
  expect(pushStockToOzon).not.toHaveBeenCalled();
});

await test("a product without an Ozon SKU points to the manual path", async () => {
  getProductOzonSkus.mockImplementationOnce(async () => new Map());
  const result = await quoteMadeToOrderDelivery(order.id);
  expect(result.available).toBe(false);
  expect(result.reason).toContain("вручную");
  expect(holdMadeToOrderStock).not.toHaveBeenCalled();
});

await test("stock Ozon has not accepted stops before the price", async () => {
  pushStockToOzon.mockImplementationOnce(async () => ({
    updated: [],
    syncedSlugs: [],
    failed: [],
    hidden: [],
  }));
  const result = await quoteMadeToOrderDelivery(order.id);
  expect(result.available).toBe(false);
  expect(checkout).not.toHaveBeenCalled();
});

await test("a refused quote saves nothing and asks to retry", async () => {
  checkout.mockImplementationOnce(async () => ({
    ...quote,
    available: false,
  }));
  const result = await quoteMadeToOrderDelivery(order.id);
  expect(result.available).toBe(false);
  expect(result.reason).toContain("через пару минут");
  expect(saveMadeToOrderQuote).not.toHaveBeenCalled();
});

await test("an Ozon outage becomes a reason instead of an exception", async () => {
  checkout.mockImplementationOnce(async () => {
    throw new Error("timeout");
  });
  const result = await quoteMadeToOrderDelivery(order.id);
  expect(result).toEqual({
    available: false,
    reason: "Ozon не ответил. Попробуйте через пару минут",
    deliveryPriceKopecks: 0,
  });
});

await test("a paid order is shipped with a fresh quote", async () => {
  await createMadeToOrderShipment(order.id);
  expect(checkout).toHaveBeenCalledTimes(1);
  expect(createOzonDeliveryOrder).toHaveBeenCalledWith(
    expect.objectContaining({
      items: [{ sku: 501, quantity: 1, price: 390000 }],
      delivery: { method: "pickup", pointId: "77" },
      checkout: quote,
    }),
  );
  expect(attachOzonOrder).toHaveBeenCalledWith(
    order.id,
    "attempt-1",
    "ozon-1",
    ["posting-1"],
  );
  expect(notifyStaffAlert).not.toHaveBeenCalled();
});

await test("an order nobody can claim is left alone", async () => {
  claimMadeToOrderShipment.mockImplementationOnce(async () => null);
  await createMadeToOrderShipment(order.id);
  expect(checkout).not.toHaveBeenCalled();
  expect(createOzonDeliveryOrder).not.toHaveBeenCalled();
});

await test("a changed Ozon price is reported to the master", async () => {
  checkout.mockImplementationOnce(async () => ({
    ...quote,
    deliveryPriceKopecks: 52000,
  }));
  await createMadeToOrderShipment(order.id);
  expect(attachOzonOrder).toHaveBeenCalledTimes(1);
  expect(notifyStaffAlert).toHaveBeenCalledTimes(1);
});

await test("a failed shipment is marked and retried by the webhook", async () => {
  const error = new Error("Ozon unavailable");
  createOzonDeliveryOrder.mockImplementationOnce(async () => {
    throw error;
  });
  await expect(createMadeToOrderShipment(order.id)).rejects.toBe(error);
  expect(markProductOrderOzonFailed).toHaveBeenCalledWith(
    order.id,
    "attempt-1",
  );
  expect(notifyOzonOrderFailed).toHaveBeenCalledWith(order.id);
  expect(attachOzonOrder).not.toHaveBeenCalled();
});

await test("Ozon refusing the delivery at shipping time is a failure too", async () => {
  checkout.mockImplementationOnce(async () => ({
    ...quote,
    available: false,
  }));
  await expect(createMadeToOrderShipment(order.id)).rejects.toThrow(
    "ozon_delivery_not_available",
  );
  expect(createOzonDeliveryOrder).not.toHaveBeenCalled();
  expect(markProductOrderOzonFailed).toHaveBeenCalledTimes(1);
});
