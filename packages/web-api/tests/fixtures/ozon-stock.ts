import { mock } from "bun:test";
import assert from "node:assert/strict";
import { and, eq, inArray, isNotNull, lt, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const product = {
  slug: "vase",
  ozonProductId: 1,
  ozonOfferId: "offer-1",
  ozonSku: 123,
  stockAvailable: 5,
  sellOnOzon: false,
};
let rows = [product];
// Сверка с Ozon: что вернёт UPDATE и с каким условием он ушёл
const updateFilters: string[] = [];
let updateSets: { stockAvailable: number }[] = [];
let updateMatches = true;
let filters: string[] = [];
mock.module("@stariva/db", () => ({
  and,
  eq,
  inArray,
  isNotNull,
  lt,
  db: {
    update: () => ({
      set: (values: { stockAvailable: number }) => ({
        where: (condition: SQL) => ({
          returning: async () => {
            updateSets.push(values);
            updateFilters.push(new PgDialect().sqlToQuery(condition).sql);
            return updateMatches ? [{ id: "p1" }] : [];
          },
        }),
      }),
    }),
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
mock.module("@stariva/config", () => ({
  logger: { warn() {}, info() {} },
}));
mock.module("../../src/env", () => ({
  env: {
    OZON_CLIENT_ID: "fixture",
    OZON_API_KEY: "fixture",
    OZON_FBS_WAREHOUSE_ID: 1,
  },
}));
const { pushStockToOzon, pullStockFromOzon } = await import(
  "../../src/services/ozon-stock"
);
let visibilityErrors: { sku: number; code: string }[] = [];
let omitted = false;
let failVisibility = false;
let sent: number[] = [];
let onStock = async (_stock: number) => {};
let placements: { sku: number; placement: string }[] = [];
let warehouseStocks: unknown[] = [];
const warehouseRequests: unknown[] = [];
globalThis.fetch = mock(async (url, options) => {
  const body = JSON.parse(String(options?.body));
  if (String(url).endsWith("/v2/product/info/stocks-by-warehouse/fbs")) {
    warehouseRequests.push(body);
    return Response.json({ products: warehouseStocks, has_next: false });
  }
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
  placements = body.item_placement;
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
assert.deepEqual(placements, [{ sku: 123, placement: "NONE" }]);

// A product sold on the Ozon marketplace is shown there instead of hidden.
rows = [{ ...product, sellOnOzon: true }];
const shown = await pushStockToOzon(["vase"]);
assert.deepEqual(placements, [{ sku: 123, placement: "OZON" }]);
assert.deepEqual(shown.shown, [123]);
assert.deepEqual(shown.hidden, []);
assert.deepEqual(shown.syncedSlugs, ["vase"]);
// It stays on the Ozon storefront with zero stock too.
rows = [{ ...product, sellOnOzon: true, stockAvailable: 0 }];
placements = [];
assert.deepEqual((await pushStockToOzon(["vase"])).shown, [123]);
// A rejected placement means the product is not synced.
visibilityErrors = [{ sku: 123, code: "REJECTED" }];
assert.deepEqual((await pushStockToOzon(["vase"])).syncedSlugs, []);
visibilityErrors = [];
rows = [product];
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

// Pulling stock back: an Ozon marketplace sale lowers the site stock.
const sold = { ...product, id: "p1", category: "interior", sellOnOzon: true };
rows = [sold];
warehouseStocks = [
  // Another warehouse is ignored; ours has 3 free of 5.
  { sku: 123, warehouse_id: 2, free_stock: 0 },
  { sku: "123", warehouse_id: 1, free_stock: 3 },
];
const pulled = await pullStockFromOzon();
assert.deepEqual(warehouseRequests, [{ sku: ["123"], limit: 1000 }]);
assert.deepEqual(pulled, {
  configured: true,
  checked: 1,
  lowered: [{ slug: "vase", category: "interior", from: 5, to: 3 }],
});
assert.deepEqual(updateSets, [{ stockAvailable: 3 }]);
// Guards: same stock as read, still sold on Ozon, not edited just now.
assert.match(updateFilters[0] ?? "", /"stock_available" = /);
assert.match(updateFilters[0] ?? "", /"sell_on_ozon" = /);
assert.match(updateFilters[0] ?? "", /"updated_at" < /);

// Ozon has the same or more: the site stock is never raised.
updateSets = [];
for (const free_stock of [5, 9]) {
  warehouseStocks = [{ sku: 123, warehouse_id: 1, free_stock }];
  assert.deepEqual((await pullStockFromOzon()).lowered, []);
}
// No row for our warehouse: unknown stock, leave it alone.
warehouseStocks = [{ sku: 123, warehouse_id: 2, free_stock: 0 }];
assert.deepEqual((await pullStockFromOzon()).lowered, []);
assert.deepEqual(updateSets, []);

// The stock changed or was edited a moment ago: the guarded update is a no-op.
warehouseStocks = [{ sku: 123, warehouse_id: 1, free_stock: 0 }];
updateMatches = false;
assert.deepEqual((await pullStockFromOzon()).lowered, []);
assert.deepEqual(updateSets, [{ stockAvailable: 0 }]);
rows = [product];

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
