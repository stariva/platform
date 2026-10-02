import { mock } from "bun:test";
import assert from "node:assert/strict";

let warning: { splits: { reason?: string }[] } | undefined;
mock.module("@stariva/config", () => ({
  logger: {
    warn: (_event: string, data: typeof warning) => {
      warning = data;
    },
  },
}));
mock.module("../../src/lib/ozon-delivery/auth", () => ({
  getOzonDeliveryToken: async () => "fixture",
  isOzonDeliveryConfigured: () => true,
}));
const { checkout } = await import("../../src/lib/ozon-delivery/client");
let splitReason: string | undefined = "UNSPECIFIED";
let methodReason: string | undefined = "OUT_OF_STOCK";
globalThis.fetch = mock(async () =>
  Response.json({
    splits: [
      {
        delivery_schema: "UNSPECIFIED",
        warehouse_id: 0,
        items: [{ sku: 123, quantity: 1 }],
        unavailable_reason: splitReason,
        delivery_method: {
          id: 1,
          delivery_type: "PVZ",
          timeslots: [],
          unavailable_reason: methodReason,
        },
      },
    ],
  }),
) as unknown as typeof fetch;
const request = {
  buyerPhone: "+79991234567",
  delivery: { method: "pickup" as const, pointId: "1" },
  items: [{ sku: 123, quantity: 1 }],
};
for (const [split, method, expected] of [
  ["UNSPECIFIED", "OUT_OF_STOCK", "OUT_OF_STOCK"],
  ["BLOCKED", "OUT_OF_STOCK", "BLOCKED"],
  [undefined, "OUT_OF_STOCK", "OUT_OF_STOCK"],
  ["UNSPECIFIED", "UNSPECIFIED", undefined],
]) {
  splitReason = split;
  methodReason = method;
  assert.equal((await checkout(request)).available, false);
  assert.equal(warning?.splits[0]?.reason, expected);
}
