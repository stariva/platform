import { expect, mock, test } from "bun:test";

let pushResult = true;
const pushCalls: string[][] = [];
mock.module("../../../storefront", () => ({
  pushStorefrontStockToOzon: async (slugs: string[]) => {
    pushCalls.push(slugs);
    return pushResult;
  },
  revalidateStorefront: async () => true,
}));

// Importing the router creates a pool; these tests only use the fake DB below.
const originalUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL ??= "postgres://postgres@localhost/set_stock_test";
const { setStock } = await import("./set-stock");
if (originalUrl === undefined) delete process.env.POSTGRES_URL;

interface ProductRow {
  category: string;
  slug: string;
  ozonSku: number | null;
  ozonOfferId: string | null;
}

function call(product: ProductRow | undefined, stockAvailable = 3) {
  const updates: { stockAvailable: number }[] = [];
  const db = {
    select: () => ({
      from: () => ({
        where: async () => (product ? [product] : []),
      }),
    }),
    update: () => ({
      set: (values: { stockAvailable: number }) => {
        updates.push(values);
        return { where: async () => undefined };
      },
    }),
  };
  const handler = setStock["~orpc"].handler;
  return {
    updates,
    result: handler({
      context: { db } as unknown as Parameters<typeof handler>[0]["context"],
      input: { id: "product", stockAvailable },
      path: [],
      procedure: setStock,
      errors: {},
      lastEventId: undefined,
    }),
  };
}

const unlinked = {
  category: "interior",
  slug: "vase",
  ozonSku: null,
  ozonOfferId: null,
};
const linked = { ...unlinked, ozonSku: 123, ozonOfferId: "vase-1" };

test("saves stock for a product without an Ozon link", async () => {
  pushCalls.length = 0;
  const { result, updates } = call(unlinked);

  await expect(result).resolves.toEqual({
    stockAvailable: 3,
    revalidated: true,
    ozonSynced: null,
  });
  expect(updates).toEqual([{ stockAvailable: 3 }]);
  expect(pushCalls).toEqual([]);
});

test("pushes stock to Ozon only for a fully linked product", async () => {
  pushCalls.length = 0;
  pushResult = true;
  const { result } = call(linked);

  await expect(result).resolves.toMatchObject({ ozonSynced: true });
  expect(pushCalls).toEqual([["vase"]]);
});

test("reports an Ozon sync failure for a linked product", async () => {
  pushCalls.length = 0;
  pushResult = false;
  const { result } = call(linked);

  await expect(result).resolves.toMatchObject({ ozonSynced: false });
  expect(pushCalls).toEqual([["vase"]]);
});

test("reports a missing product", async () => {
  const { result, updates } = call(undefined);

  await expect(result).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(updates).toEqual([]);
});
