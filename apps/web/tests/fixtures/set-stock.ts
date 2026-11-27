import { mock } from "bun:test";
import assert from "node:assert/strict";

let offerId: string | null = null;
let sku: number | null = 123;
let updates = 0;
let pushes = 0;
mock.module("@stariva/db", () => ({ eq() {}, products: {} }));
mock.module("../../../../packages/api/src/orpc", () => ({
  adminProcedure: { input: () => ({ handler: (fn: unknown) => fn }) },
}));
mock.module("../../../../packages/api/src/storefront", () => ({
  revalidateStorefront: async () => true,
  pushStorefrontStockToOzon: async () => {
    pushes++;
    return false;
  },
}));
const { setStock } = await import(
  "../../../../packages/api/src/routers/admin/products/set-stock"
);
const db = {
  select: () => ({
    from: () => ({
      where: async () => [
        {
          slug: "vase",
          category: "ceramics",
          ozonSku: sku,
          ozonOfferId: offerId,
        },
      ],
    }),
  }),
  update: () => ({
    set: () => ({
      where: async () => {
        updates++;
      },
    }),
  }),
};
const save = setStock as unknown as (args: {
  context: { db: typeof db };
  input: { id: string; stockAvailable: number };
}) => Promise<{ ozonSynced: boolean | null }>;

assert.equal(
  (await save({ context: { db }, input: { id: "1", stockAvailable: 5 } }))
    .ozonSynced,
  null,
);
assert.equal(updates, 1);
assert.equal(pushes, 0);
offerId = "offer-1";
sku = null;
assert.equal(
  (await save({ context: { db }, input: { id: "1", stockAvailable: 5 } }))
    .ozonSynced,
  null,
);
assert.equal(updates, 2);
assert.equal(pushes, 0);
sku = 123;
assert.equal(
  (await save({ context: { db }, input: { id: "1", stockAvailable: 5 } }))
    .ozonSynced,
  false,
);
assert.equal(pushes, 1);
assert.equal(updates, 3);
