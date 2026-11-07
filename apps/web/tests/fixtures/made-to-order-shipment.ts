import { expect, mock } from "bun:test";

const order = {
  id: "order-1",
  number: 42,
  kind: "made_to_order",
  status: "in_production",
  amountProducts: 390000,
  amountDelivery: 45000,
  deliveryMethod: "pickup" as string,
  deliveryPointId: "77" as string | null,
  contactName: "Анна",
  contactPhone: "+79001234567",
  contactEmail: null,
  checkoutSnapshot: null as unknown,
};
const parcel = { weightGrams: 800, lengthCm: 60, widthCm: 30, heightCm: 20 };
const items = [
  { id: "item-1", name: "Ёлка", price: 390000, quantity: 1, options: null },
];
const quote = { available: true as const, priceKopecks: 45000 };

const saveMadeToOrderQuote = mock(async () => true);
const claimMadeToOrderShipment = mock(
  async (): Promise<string | null> => "attempt-1",
);
const attachMadeToOrderShipment = mock(async () => {});
const markProductOrderOzonFailed = mock(async () => {});
mock.module("../../src/lib/commerce/orders", () => ({
  getProductOrderById: async () => order,
  getProductOrderItems: async () => items,
  saveMadeToOrderQuote,
  claimMadeToOrderShipment,
  attachMadeToOrderShipment,
  markProductOrderOzonFailed,
}));
const notifyOzonOrderFailed = mock(async () => {});
const notifyStaffAlert = mock(async () => {});
mock.module("../../src/lib/commerce/order-notifications", () => ({
  notifyOzonOrderFailed,
  notifyStaffAlert,
}));
let configured = true;
const quoteParcel = mock(
  async (): Promise<
    | { available: true; priceKopecks: number }
    | { available: false; reason?: string }
  > => quote,
);
const createParcelShipment = mock(async () => ({
  orderId: "ozon-1",
  postingNumbers: ["posting-1"],
}));
mock.module("@/lib/ozon-business-delivery/client", () => ({
  isOzonBusinessDeliveryConfigured: () => configured,
  quoteParcel,
  createParcelShipment,
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

await test("until the Delivery API is connected the master bills by hand", async () => {
  configured = false;
  const result = await quoteMadeToOrderDelivery(order.id, parcel);
  expect(result.available).toBe(false);
  expect(result.reason).toContain("вручную");
  expect(quoteParcel).not.toHaveBeenCalled();
});

await test("the quote uses the parcel, the point and the order value", async () => {
  expect(await quoteMadeToOrderDelivery(order.id, parcel)).toEqual({
    available: true,
    deliveryPriceKopecks: 45000,
  });
  expect(quoteParcel).toHaveBeenCalledWith({
    recipientPhone: order.contactPhone,
    pointId: "77",
    parcel,
    declaredValueKopecks: 390000,
  });
  // Расчёт привязан к пункту, до которого считали
  expect(saveMadeToOrderQuote).toHaveBeenCalledWith(
    order.id,
    { parcel, priceKopecks: 45000 },
    "77",
  );
});

await test("a quote is refused when the buyer changed the point meanwhile", async () => {
  saveMadeToOrderQuote.mockImplementationOnce(async () => false);
  expect(await quoteMadeToOrderDelivery(order.id, parcel)).toEqual({
    available: false,
    reason:
      "Покупатель сменил пункт выдачи, пока шёл расчёт. Посчитайте доставку ещё раз",
    deliveryPriceKopecks: 0,
  });
});

await test("a buyer without a pickup point gets no quote", async () => {
  order.deliveryPointId = null;
  const result = await quoteMadeToOrderDelivery(order.id, parcel);
  expect(result.available).toBe(false);
  expect(result.reason).toContain("пункт выдачи");
  expect(quoteParcel).not.toHaveBeenCalled();
});

await test("an order out of production gets no quote", async () => {
  order.status = "awaiting_balance";
  const result = await quoteMadeToOrderDelivery(order.id, parcel);
  expect(result.reason).toContain("обновите страницу");
  expect(quoteParcel).not.toHaveBeenCalled();
});

await test("a refused quote shows the reason and saves nothing", async () => {
  quoteParcel.mockImplementationOnce(async () => ({
    available: false,
    reason: "Пункт не принимает такие габариты",
  }));
  const result = await quoteMadeToOrderDelivery(order.id, parcel);
  expect(result.reason).toBe("Пункт не принимает такие габариты");
  expect(saveMadeToOrderQuote).not.toHaveBeenCalled();
});

await test("an Ozon outage becomes a reason instead of an exception", async () => {
  quoteParcel.mockImplementationOnce(async () => {
    throw new Error("timeout");
  });
  expect(await quoteMadeToOrderDelivery(order.id, parcel)).toEqual({
    available: false,
    reason: "Ozon не ответил. Попробуйте через пару минут",
    deliveryPriceKopecks: 0,
  });
});

await test("a paid order ships the saved parcel with a fresh quote", async () => {
  order.checkoutSnapshot = { parcel, priceKopecks: 45000 };
  await createMadeToOrderShipment(order.id);
  expect(quoteParcel).toHaveBeenCalledTimes(1);
  expect(createParcelShipment).toHaveBeenCalledWith({
    recipientPhone: order.contactPhone,
    pointId: "77",
    parcel,
    declaredValueKopecks: 390000,
    externalOrderId: order.id,
    recipientName: "Анна",
    items: [{ name: "Ёлка", quantity: 1, priceKopecks: 390000 }],
  });
  expect(attachMadeToOrderShipment).toHaveBeenCalledWith(
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
  expect(quoteParcel).not.toHaveBeenCalled();
  expect(createParcelShipment).not.toHaveBeenCalled();
});

await test("a changed Ozon price is reported to the master", async () => {
  order.checkoutSnapshot = { parcel, priceKopecks: 45000 };
  quoteParcel.mockImplementationOnce(async () => ({
    available: true,
    priceKopecks: 52000,
  }));
  await createMadeToOrderShipment(order.id);
  expect(attachMadeToOrderShipment).toHaveBeenCalledTimes(1);
  expect(notifyStaffAlert).toHaveBeenCalledTimes(1);
});

await test("a failed shipment is marked and retried by the webhook", async () => {
  order.checkoutSnapshot = { parcel, priceKopecks: 45000 };
  const error = new Error("Ozon unavailable");
  createParcelShipment.mockImplementationOnce(async () => {
    throw error;
  });
  await expect(createMadeToOrderShipment(order.id)).rejects.toBe(error);
  expect(markProductOrderOzonFailed).toHaveBeenCalledWith(
    order.id,
    "attempt-1",
  );
  expect(notifyOzonOrderFailed).toHaveBeenCalledWith(order.id);
  expect(attachMadeToOrderShipment).not.toHaveBeenCalled();
});

await test("Ozon refusing the delivery at shipping time is a failure too", async () => {
  order.checkoutSnapshot = { parcel, priceKopecks: 45000 };
  quoteParcel.mockImplementationOnce(async () => ({ available: false }));
  await expect(createMadeToOrderShipment(order.id)).rejects.toThrow(
    "ozon_delivery_not_available",
  );
  expect(createParcelShipment).not.toHaveBeenCalled();
  expect(markProductOrderOzonFailed).toHaveBeenCalledTimes(1);
});

await test("a saved order without a parcel cannot ship", async () => {
  order.checkoutSnapshot = { splits: [] };
  await expect(createMadeToOrderShipment(order.id)).rejects.toThrow(
    "order_without_parcel_or_pickup_point",
  );
  expect(createParcelShipment).not.toHaveBeenCalled();
});
