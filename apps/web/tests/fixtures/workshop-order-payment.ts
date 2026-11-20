import { expect, mock } from "bun:test";

const grants: string[] = [];
let failExtra = true;
mock.module("@/lib/account/access", () => ({
  grantAccess: async (_user: string, slug: string) => {
    if (slug === "elka-makrame-bolshaya" && failExtra) {
      failExtra = false;
      throw new Error("access failed");
    }
    grants.push(slug);
  },
}));
mock.module("@/lib/npd/issue", () => ({ issueNpdReceipt: async () => {} }));
mock.module("@/lib/payments/orders", () => ({
  markOrderPaid: async () => false,
  markOrderCanceled: async () => {},
}));
mock.module("../../src/lib/workshops/notifications", () => ({
  notifyWorkshopBooked: async () => {},
}));
mock.module("../../src/lib/workshops/workshops-db", () => ({
  getWorkshopBySlug: async () => null,
}));
const { applyWorkshopPayment } = await import(
  "../../src/lib/workshops/order-payment"
);
const order = {
  id: "bundle-order",
  userId: "buyer",
  workshopSlug: "elka-makrame",
  bundleSlug: "elka-makrame-kombo",
  amount: 159000,
  createdAt: new Date("2030-01-01"),
} as unknown as Parameters<typeof applyWorkshopPayment>[0];
const payment = {
  id: "payment",
  status: "succeeded" as const,
  paid: true,
  amount: { value: "1590.00", currency: "RUB" },
};
await expect(applyWorkshopPayment(order, payment)).rejects.toThrow(
  "access failed",
);
await applyWorkshopPayment(order, payment);
expect(grants).toEqual([
  "elka-makrame",
  "elka-makrame",
  "elka-makrame-bolshaya",
]);
