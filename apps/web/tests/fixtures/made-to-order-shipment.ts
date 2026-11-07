import { expect, mock } from "bun:test";

const parcel = { weightGrams: 800, lengthCm: 60, widthCm: 30, heightCm: 20 };
const order = {
  id: "order-1",
  number: 42,
  kind: "made_to_order",
  // Изделие готово: мастер указала посылку, покупатель ещё не выбрал пункт
  status: "awaiting_balance",
  amountProducts: 390000,
  amountDelivery: 0,
  deliveryMethod: "manual" as string,
  deliveryPointId: null as string | null,
  contactName: "Анна",
  contactPhone: "+79001234567",
  contactEmail: null,
  checkoutSnapshot: { parcel, priceKopecks: null } as unknown,
};
const items = [
  { id: "item-1", name: "Ёлка", price: 390000, quantity: 1, options: null },
];
const quote = { available: true as const, priceKopecks: 45000 };

const saveMadeToOrderDeliveryPrice = mock(async () => true);
const claimMadeToOrderShipment = mock(
  async (): Promise<string | null> => "attempt-1",
);
const attachMadeToOrderShipment = mock(async () => {});
const markProductOrderOzonFailed = mock(async () => {});
const markMadeToOrderShipmentUnapproved = mock(async () => {});
mock.module("../../src/lib/commerce/orders", () => ({
  getProductOrderById: async () => order,
  getProductOrderItems: async () => items,
  saveMadeToOrderDeliveryPrice,
  claimMadeToOrderShipment,
  attachMadeToOrderShipment,
  markProductOrderOzonFailed,
  markMadeToOrderShipmentUnapproved,
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
    | { available: false; reason?: string; cause?: "point" }
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

const { createMadeToOrderShipment, priceMadeToOrderDelivery } = await import(
  "../../src/lib/commerce/made-to-order-shipment"
);
const { OzonBusinessAccessError, ParcelNotApprovedError } = await import(
  "../../src/lib/ozon-business-delivery/errors"
);

// Запускается отдельным процессом, чтобы моки не подменяли модули других тестов.
const scenario = process.argv[2];
async function test(name: string, run: () => Promise<void>) {
  if (name === scenario) await run();
}

const pointInfo = {
  id: "77",
  title: "ул. Баумана, 1",
  address: "Казань, ул. Баумана, 1",
} as never;

/** Доплата с доставкой оплачена: пункт выбран, цена Ozon сохранена. */
function paidInFull() {
  order.status = "ready_to_ship";
  order.deliveryMethod = "pickup";
  order.deliveryPointId = "77";
  order.amountDelivery = 45000;
  order.checkoutSnapshot = { parcel, priceKopecks: 45000 };
}

await test("the delivery is priced for the chosen point and saved together with it", async () => {
  expect(await priceMadeToOrderDelivery(order.id, "77", pointInfo)).toBe("ok");
  // Считаем посылку, которую упаковала мастер, и стоимость изделия как объявленную
  expect(quoteParcel).toHaveBeenCalledWith({
    recipientPhone: order.contactPhone,
    pointId: "77",
    parcel,
    declaredValueKopecks: 390000,
  });
  expect(saveMadeToOrderDeliveryPrice).toHaveBeenCalledWith(
    order.id,
    "77",
    pointInfo,
    45000,
  );
  expect(notifyStaffAlert).not.toHaveBeenCalled();
});

await test("a point Ozon refuses is for the buyer to change, the master is not bothered", async () => {
  quoteParcel.mockImplementationOnce(async () => ({
    available: false,
    reason: "Пункт не принимает такие габариты",
    cause: "point",
  }));
  expect(await priceMadeToOrderDelivery(order.id, "77", pointInfo)).toBe(
    "unavailable",
  );
  expect(saveMadeToOrderDeliveryPrice).not.toHaveBeenCalled();
  expect(notifyStaffAlert).not.toHaveBeenCalled();
});

await test("a refusal that is not about the point alerts the master to bill by hand", async () => {
  quoteParcel.mockImplementationOnce(async () => ({
    available: false,
    reason: "Покупателя с этим телефоном нет в Ozon",
  }));
  expect(await priceMadeToOrderDelivery(order.id, "77", pointInfo)).toBe(
    "quote_failed",
  );
  expect(saveMadeToOrderDeliveryPrice).not.toHaveBeenCalled();
  expect(notifyStaffAlert).toHaveBeenCalledTimes(1);
  const [, message] = notifyStaffAlert.mock.calls[0] as unknown as [
    string,
    { title: string; message: string },
  ];
  expect(message.title).toContain("не посчитал доставку");
  expect(message.message).toContain("нет в Ozon");
  expect(message.message).toContain("вручную");
});

await test("an Ozon outage asks the buyer to retry and does not alert the master", async () => {
  quoteParcel.mockImplementationOnce(async () => {
    throw new Error("timeout");
  });
  expect(await priceMadeToOrderDelivery(order.id, "77", pointInfo)).toBe(
    "quote_failed",
  );
  expect(saveMadeToOrderDeliveryPrice).not.toHaveBeenCalled();
  expect(notifyStaffAlert).not.toHaveBeenCalled();
});

await test("keys Ozon no longer accepts alert the master instead of asking the buyer to retry", async () => {
  quoteParcel.mockImplementationOnce(async () => {
    throw new OzonBusinessAccessError(401, "invalid_client");
  });
  expect(await priceMadeToOrderDelivery(order.id, "77", pointInfo)).toBe(
    "quote_failed",
  );
  expect(saveMadeToOrderDeliveryPrice).not.toHaveBeenCalled();
  expect(notifyStaffAlert).toHaveBeenCalledTimes(1);
  const [, message] = notifyStaffAlert.mock.calls[0] as unknown as [
    string,
    { title: string; message: string },
  ];
  expect(message.message).toContain("ключи");
  expect(message.message).toContain("вручную");
});

await test("until the Delivery API is connected the master is told to bill by hand", async () => {
  configured = false;
  expect(await priceMadeToOrderDelivery(order.id, "77", pointInfo)).toBe(
    "quote_failed",
  );
  expect(quoteParcel).not.toHaveBeenCalled();
  expect(notifyStaffAlert).toHaveBeenCalledTimes(1);
});

await test("an order that no longer waits for the balance is locked", async () => {
  order.status = "ready_to_ship";
  expect(await priceMadeToOrderDelivery(order.id, "77", pointInfo)).toBe(
    "locked",
  );
  expect(quoteParcel).not.toHaveBeenCalled();
});

await test("an order billed by hand has no parcel and asks for no point", async () => {
  order.checkoutSnapshot = null;
  expect(await priceMadeToOrderDelivery(order.id, "77", pointInfo)).toBe(
    "locked",
  );
  expect(quoteParcel).not.toHaveBeenCalled();
});

await test("a price that lost the race to a payment is not saved as done", async () => {
  saveMadeToOrderDeliveryPrice.mockImplementationOnce(async () => false);
  expect(await priceMadeToOrderDelivery(order.id, "77", pointInfo)).toBe(
    "locked",
  );
});

await test("a paid order ships the saved parcel with a fresh quote", async () => {
  paidInFull();
  await createMadeToOrderShipment(order.id, "payment-1");
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
  await createMadeToOrderShipment(order.id, "payment-1");
  expect(quoteParcel).not.toHaveBeenCalled();
  expect(createParcelShipment).not.toHaveBeenCalled();
});

await test("a changed Ozon price is reported to the master", async () => {
  paidInFull();
  quoteParcel.mockImplementationOnce(async () => ({
    available: true,
    priceKopecks: 52000,
  }));
  await createMadeToOrderShipment(order.id, "payment-1");
  expect(attachMadeToOrderShipment).toHaveBeenCalledTimes(1);
  expect(notifyStaffAlert).toHaveBeenCalledTimes(1);
});

await test("a failed shipment is marked and retried by the webhook", async () => {
  paidInFull();
  const error = new Error("Ozon unavailable");
  createParcelShipment.mockImplementationOnce(async () => {
    throw error;
  });
  await expect(createMadeToOrderShipment(order.id, "payment-1")).rejects.toBe(
    error,
  );
  expect(markProductOrderOzonFailed).toHaveBeenCalledWith(
    order.id,
    "attempt-1",
  );
  expect(notifyOzonOrderFailed).toHaveBeenCalledWith(order.id);
  expect(attachMadeToOrderShipment).not.toHaveBeenCalled();
});

await test("a parcel Ozon created but did not approve keeps its numbers and is not retried", async () => {
  paidInFull();
  createParcelShipment.mockImplementationOnce(async () => {
    throw new ParcelNotApprovedError(
      { orderId: "ozon-1", postingNumbers: ["posting-1"] },
      new Error("NotEnoughBalance"),
    );
  });
  // Не бросает: повтор webhook создал бы в Ozon второй такой же заказ
  await createMadeToOrderShipment(order.id, "payment-1");
  expect(markMadeToOrderShipmentUnapproved).toHaveBeenCalledWith(
    order.id,
    "attempt-1",
    "ozon-1",
    ["posting-1"],
    // Уведомление об этой оплате станет неотправленным в той же транзакции
    "payment-1",
  );
  expect(markProductOrderOzonFailed).not.toHaveBeenCalled();
  expect(attachMadeToOrderShipment).not.toHaveBeenCalled();
  // Мастеру скажет уведомление об оплате: оно повторяется вместе с webhook
  expect(notifyOzonOrderFailed).not.toHaveBeenCalled();
});

await test("Ozon refusing the delivery at shipping time is a failure too", async () => {
  paidInFull();
  quoteParcel.mockImplementationOnce(async () => ({ available: false }));
  await expect(
    createMadeToOrderShipment(order.id, "payment-1"),
  ).rejects.toThrow("ozon_delivery_not_available");
  expect(createParcelShipment).not.toHaveBeenCalled();
  expect(markProductOrderOzonFailed).toHaveBeenCalledTimes(1);
});

await test("a saved order without a parcel cannot ship", async () => {
  order.checkoutSnapshot = { splits: [] };
  await expect(
    createMadeToOrderShipment(order.id, "payment-1"),
  ).rejects.toThrow("order_without_parcel_or_pickup_point");
  expect(createParcelShipment).not.toHaveBeenCalled();
});
