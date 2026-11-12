import { expect, mock } from "bun:test";

const order = {
  id: "order-1",
  number: 42,
  kind: "stock",
  amountTotal: 12000,
  amountDelivery: 2000,
  deliveryMethod: "pickup",
  deliveryPointId: "point-1",
};
const item = {
  id: "item-1",
  name: "Изделие",
  price: 10000,
  quantity: 1,
  ozonSku: 1,
};
const getProductOrderItems = mock(async () => [item]);
const getProductOrderCustomerEmail = mock(
  async (): Promise<string | null> => "buyer@example.test",
);
const claimProductOrderShipment = mock(
  async (): Promise<string | null> => "attempt-1",
);
const markProductOrderOzonFailed = mock(async () => {});
const attachOzonOrder = mock(async () => {});
// Порядок вызовов: мастеру сообщают после отправления, а не до него
const calls: string[] = [];
const getOrderPayment = mock(
  async (): Promise<{
    id: string;
    orderId: string;
    type: string;
    amount: number;
  } | null> => null,
);
mock.module("../../src/lib/commerce/orders", () => ({
  getProductOrderById: async () => order,
  markProductOrderPaid: async () => true,
  getProductOrderItems,
  getProductOrderCustomerEmail,
  claimProductOrderShipment,
  markProductOrderOzonFailed,
  attachOzonOrder,
  applyMadeToOrderPayment: async () => true,
  getOrderPayment,
  listOrderPayments: async () => [],
  markOrderPaymentCanceled: async () => {},
  markOrderPaymentSucceeded: async () => false,
  markProductOrderCanceled: async () => {},
}));
const createMadeToOrderShipment = mock(
  async (_orderId: string, paymentId: string) => {
    calls.push(`ship:${paymentId}`);
  },
);
mock.module("../../src/lib/commerce/made-to-order-shipment", () => ({
  createMadeToOrderShipment,
}));
const notifyOzonOrderFailed = mock(async () => {});
const notifyMadeToOrderPayment = mock(async (id: string) => {
  calls.push(`notify:${id}`);
});
mock.module("../../src/lib/commerce/order-notifications", () => ({
  notifyCustomer: async () => {},
  notifyMadeToOrderPayment,
  notifyOrderPaid: async () => {},
  notifyOzonOrderFailed,
}));
const issueNpdReceipt = mock(async () => {});
mock.module("@/lib/npd/issue", () => ({ issueNpdReceipt }));
const createOzonDeliveryOrder = mock(async () => ({
  orderId: "ozon-1",
  postingNumbers: ["posting-1"],
}));
mock.module("@/lib/ozon-delivery/client", () => ({ createOzonDeliveryOrder }));
mock.module("@/lib/payments/yookassa", () => ({
  getPayment: async () => null,
  kopecksToValue: (amount: number) => (amount / 100).toFixed(2),
}));
const grantKitWorkshops = mock(async (_id: string) => {});
mock.module("@/lib/workshops/kit-access", () => ({ grantKitWorkshops }));
const { applyProductOrderPayment } = await import(
  "../../src/lib/commerce/order-payment"
);
const apply = () =>
  applyProductOrderPayment(order.id, {
    id: "payment-1",
    status: "succeeded",
    paid: true,
    amount: { value: "120.00", currency: "RUB" },
  });

// Запускается отдельным процессом, чтобы моки не подменяли модули других тестов.
const scenario = process.argv[2];
async function test(name: string, run: () => Promise<void>) {
  if (name === scenario) await run();
}

await test("item loading failures claim the shipment and notify staff before rethrowing", async () => {
  const error = new Error("items unavailable");
  getProductOrderItems.mockRejectedValueOnce(error);
  await expect(apply()).rejects.toBe(error);
  expect(claimProductOrderShipment).toHaveBeenCalledTimes(1);
  expect(markProductOrderOzonFailed).toHaveBeenCalledWith(
    order.id,
    "attempt-1",
  );
  expect(notifyOzonOrderFailed).toHaveBeenCalledWith(order.id);
  expect(createOzonDeliveryOrder).not.toHaveBeenCalled();
});

await test("receipt preparation failures use the same shipment fallback", async () => {
  const error = new Error("email lookup failed");
  getProductOrderCustomerEmail.mockRejectedValueOnce(error);
  await expect(apply()).rejects.toBe(error);
  expect(markProductOrderOzonFailed).toHaveBeenCalledWith(
    order.id,
    "attempt-1",
  );
  expect(notifyOzonOrderFailed).toHaveBeenCalledWith(order.id);
});

await test("fallback leaves another worker's shipment alone", async () => {
  getProductOrderItems.mockRejectedValueOnce(new Error("items unavailable"));
  claimProductOrderShipment.mockResolvedValueOnce(null);
  await expect(apply()).rejects.toThrow("items unavailable");
  expect(markProductOrderOzonFailed).not.toHaveBeenCalled();
  expect(notifyOzonOrderFailed).not.toHaveBeenCalled();
});

await test("Ozon failures reuse the claimed attempt", async () => {
  createOzonDeliveryOrder.mockRejectedValueOnce(new Error("Ozon unavailable"));
  await expect(apply()).rejects.toThrow("Ozon unavailable");
  expect(claimProductOrderShipment).toHaveBeenCalledTimes(1);
  expect(markProductOrderOzonFailed).toHaveBeenCalledWith(
    order.id,
    "attempt-1",
  );
  expect(notifyOzonOrderFailed).toHaveBeenCalledWith(order.id);
});

await test("receipts are still processed when a shipment needs no new attempt", async () => {
  claimProductOrderShipment.mockResolvedValueOnce(null);
  await apply();
  expect(issueNpdReceipt).toHaveBeenCalledTimes(1);
  expect(createOzonDeliveryOrder).not.toHaveBeenCalled();
});

await test("successful shipment remains linked to its attempt", async () => {
  await apply();
  expect(attachOzonOrder).toHaveBeenCalledWith(
    order.id,
    "attempt-1",
    "ozon-1",
    ["posting-1"],
  );
  expect(markProductOrderOzonFailed).not.toHaveBeenCalled();
});

// Доплата заказа под заказ: webhook создаёт отправление, затем сообщает мастеру
const applyStage = (type: "deposit" | "balance") => {
  order.kind = "made_to_order";
  getOrderPayment.mockResolvedValueOnce({
    id: "row-1",
    orderId: order.id,
    type,
    amount: 12000,
  });
  return applyProductOrderPayment(order.id, {
    id: "payment-1",
    status: "succeeded",
    paid: true,
    amount: { value: "120.00", currency: "RUB" },
    metadata: { orderPaymentId: "row-1" },
  });
};

await test("a balance payment gives the shipment its own id before the master is told", async () => {
  // По этому id неподтверждённый заказ снова делает уведомление об оплате
  // неотправленным, поэтому оно должно идти после отправления
  await applyStage("balance");
  expect(createMadeToOrderShipment).toHaveBeenCalledWith(order.id, "row-1");
  expect(calls).toEqual(["ship:row-1", "notify:row-1"]);
});

await test("a shipment failure still tells the master and then rethrows", async () => {
  const error = new Error("Ozon unavailable");
  createMadeToOrderShipment.mockImplementationOnce(
    async (_orderId, paymentId) => {
      calls.push(`ship:${paymentId}`);
      throw error;
    },
  );
  await expect(applyStage("balance")).rejects.toBe(error);
  expect(calls).toEqual(["ship:row-1", "notify:row-1"]);
});

await test("a deposit never touches the shipment", async () => {
  await applyStage("deposit");
  expect(createMadeToOrderShipment).not.toHaveBeenCalled();
  expect(calls).toEqual(["notify:row-1"]);
});

if (
  scenario.includes("balance") ||
  scenario === "a deposit never touches the shipment"
) {
  expect(grantKitWorkshops).toHaveBeenCalledTimes(
    scenario.includes("balance") ? 1 : 0,
  );
}
