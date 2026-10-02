import { mock } from "bun:test";
import assert from "node:assert/strict";
import { and, inArray, isNotNull, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const product = {
  slug: "vase",
  ozonProductId: 1,
  ozonOfferId: "offer-1",
  ozonSku: 123,
  stockAvailable: 5,
};
let rows = [product];
let filters: string[] = [];
mock.module("@stariva/db", () => ({
  and,
  inArray,
  isNotNull,
  db: {
    select: () => ({
      from: () => ({
        where: async (condition: SQL) => {
          filters.push(new PgDialect().sqlToQuery(condition).sql);
          return rows.map((row) => ({ ...row }));
        },
      }),
    }),
  },
}));
mock.module("@stariva/config", () => ({ logger: { warn() {} } }));
mock.module("../../src/env", () => ({
  env: {
    OZON_CLIENT_ID: "fixture",
    OZON_API_KEY: "fixture",
    OZON_FBS_WAREHOUSE_ID: 1,
  },
}));
const { pushStockToOzon } = await import("../../src/lib/ozon/stock-push");
let visibilityErrors: { sku: number; code: string }[] = [];
let omitted = false;
let failVisibility = false;
let sent: number[] = [];
let onStock = async (_stock: number) => {};
globalThis.fetch = mock(async (_url, options) => {
  const body = JSON.parse(String(options?.body));
  if (body.stocks) {
    const stock = body.stocks[0].stock;
    sent.push(stock);
    await onStock(stock);
    return Response.json({
      result: omitted ? [] : [{ offer_id: "offer-1", updated: true }],
    });
  }
  if (failVisibility) {
    failVisibility = false;
    throw new Error("visibility timeout");
  }
  return Response.json({ items_errors: visibilityErrors });
}) as unknown as typeof fetch;

rows = [{ ...product, stockAvailable: 0 }];
assert.deepEqual((await pushStockToOzon()).updated, ["offer-1"]);
assert.deepEqual(sent, [0]);
assert.ok(filters.every((filter) => !filter.includes("stock_available")));
filters = [];
await pushStockToOzon(["vase"]);
assert.ok(filters.every((filter) => filter.includes('"slug" in')));

rows = [product];
visibilityErrors = [
  { sku: 123, code: "REJECTED" },
  { sku: 999, code: "UNKNOWN" },
];
const rejected = await pushStockToOzon(["vase"]);
assert.equal(rejected.failed.length, 2);
assert.match(rejected.failed[0]?.error ?? "", /REJECTED/);
assert.deepEqual(rejected.hidden, []);
assert.deepEqual(rejected.syncedSlugs, []);
visibilityErrors = [];
assert.deepEqual((await pushStockToOzon(["vase"])).syncedSlugs, ["vase"]);
omitted = true;
assert.deepEqual((await pushStockToOzon(["vase"])).syncedSlugs, []);
omitted = false;
rows = [];
assert.deepEqual((await pushStockToOzon(["missing"])).syncedSlugs, []);

// The older request lands after the newer request; it must repair its snapshot.
rows = [product];
sent = [];
let releaseOld!: () => void;
let oldStarted!: () => void;
const started = new Promise<void>((resolve) => {
  oldStarted = resolve;
});
const released = new Promise<void>((resolve) => {
  releaseOld = resolve;
});
let ozonStock = 0;
onStock = async (stock) => {
  if (stock === 5) {
    oldStarted();
    await released;
  }
  ozonStock = stock;
};
const oldSync = pushStockToOzon(["vase"]);
await started;
rows = [{ ...product, stockAvailable: 9 }];
await pushStockToOzon(["vase"]);
releaseOld();
await oldSync;
assert.equal(ozonStock, 9);
assert.deepEqual(sent, [5, 9, 9]);

// A failure after sending old stock must still recheck and repair changed stock.
rows = [product];
sent = [];
failVisibility = true;
onStock = async (stock) => {
  ozonStock = stock;
  rows = [{ ...product, stockAvailable: 9 }];
};
await pushStockToOzon(["vase"]);
assert.equal(ozonStock, 9);
assert.deepEqual(sent, [5, 9]);
failVisibility = true;
await assert.rejects(pushStockToOzon(["vase"]), /visibility timeout/);

// The command-line push must fail when stock succeeds but hiding fails.
onStock = async () => {};
visibilityErrors = [{ sku: 123, code: "REJECTED" }];
const exitCalled = new Error("exit called");
process.exit = ((code: number) => {
  assert.equal(code, 1);
  throw exitCalled;
}) as typeof process.exit;
await assert.rejects(
  import("../../scripts/push-ozon-stock"),
  (error) => error === exitCalled,
);
