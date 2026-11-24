import { expect, mock, test } from "bun:test";
import type { MadeToOrderDeliverySweepResult } from "@stariva/web-api/contract";

let sweep = async (): Promise<MadeToOrderDeliverySweepResult | null> => ({
  checked: 2,
  repriced: 1,
  shipped: 1,
  failed: 0,
});
mock.module("../../../storefront", () => ({
  pushStorefrontStockToOzon: async () => true,
  revalidateStorefront: async () => true,
  sweepStorefrontOzonDeliveries: () => sweep(),
}));

// Importing the router creates a pool; these tests only use the mock above.
const originalUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL ??= "postgres://postgres@localhost/order_balance_test";
const { sweepOzonDeliveries } = await import("./sweep-ozon");
if (originalUrl === undefined) delete process.env.POSTGRES_URL;

const handler = sweepOzonDeliveries["~orpc"].handler;
const run = () =>
  handler({
    context: {} as unknown as Parameters<typeof handler>[0]["context"],
    input: undefined,
    path: [],
    procedure: sweepOzonDeliveries,
    errors: {},
    lastEventId: undefined,
  });

test("the button reports what the storefront sweep did", async () => {
  expect(await run()).toEqual({
    ran: true,
    checked: 2,
    repriced: 1,
    shipped: 1,
    failed: 0,
  });
});

test("the button reports an unreachable storefront instead of failing", async () => {
  sweep = async () => null;
  expect(await run()).toEqual({
    ran: false,
    checked: 0,
    repriced: 0,
    shipped: 0,
    failed: 0,
  });
});
