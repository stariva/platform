import { mock } from "bun:test";
import assert from "node:assert/strict";
import { implement } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { WEB_RPC_PATH, webContract } from "@stariva/web-api/contract";

const env = {
  STOREFRONT_URL: "https://store.example",
  REVALIDATE_SECRET: "fixture",
};
mock.module("@stariva/config", () => ({ env, logger: { warn() {} } }));
const { pushStorefrontStockToOzon, revalidateStorefront } = await import(
  "../../../../packages/api/src/storefront"
);
const complete = {
  updated: ["offer-1"],
  syncedSlugs: ["vase"],
  failed: [],
  hidden: [123],
};
let body: unknown = complete;
let calls = 0;
// Витрина по контракту: ответ, не прошедший схему, станет ошибкой сервера
const handler = new RPCHandler({
  admin: {
    ozon: {
      pushStock: implement(webContract).admin.ozon.pushStock.handler(
        () => body as typeof complete,
      ),
    },
    revalidate: implement(webContract).admin.revalidate.handler(({ input }) => {
      revalidated.push(input.paths);
      return { revalidated: input.paths.length };
    }),
  },
});
const revalidated: string[][] = [];
const timeouts: number[] = [];
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((fn: () => void, ms?: number) => {
  timeouts.push(ms ?? 0);
  return realSetTimeout(fn, ms);
}) as typeof setTimeout;
globalThis.fetch = mock(async (input, init) => {
  calls++;
  const request = new Request(input, init);
  assert.equal(new URL(request.url).protocol, "https:");
  assert.equal(request.method, "POST");
  assert.equal(request.headers.get("authorization"), "Bearer fixture");
  const { matched, response } = await handler.handle(request, {
    prefix: WEB_RPC_PATH,
    context: {},
  });
  return matched ? response : new Response(null, { status: 404 });
}) as unknown as typeof fetch;
assert.equal(await pushStorefrontStockToOzon(["vase"]), true);
assert.ok(timeouts.some((ms) => ms > 20_000));
for (const invalid of [
  {},
  { failed: [] },
  null,
  { ...complete, updated: [] },
  { ...complete, syncedSlugs: [] },
  { ...complete, hidden: ["123"] },
  {
    ...complete,
    failed: [{ offerId: "offer-1", error: "visibility_REJECTED" }],
  },
]) {
  body = invalid;
  assert.equal(await pushStorefrontStockToOzon(["vase"]), false);
}
body = complete;
assert.equal(await pushStorefrontStockToOzon(["vase", "missing"]), false);
assert.equal(await pushStorefrontStockToOzon([]), false);
for (const url of [
  "http://store.example",
  "ftp://store.example",
  "file:///tmp/store",
  "invalid",
]) {
  env.STOREFRONT_URL = url;
  const before = calls;
  assert.equal(await pushStorefrontStockToOzon(["vase"]), false);
  assert.equal(await revalidateStorefront(["/"]), false);
  assert.equal(calls, before);
}
env.STOREFRONT_URL = "https://store.example";
assert.equal(await revalidateStorefront(["/", "/", "/catalog"]), true);
assert.deepEqual(revalidated, [["/", "/catalog"]]);
// Невалидный путь отбивает контракт витрины: кэш не сбрасывается
assert.equal(await revalidateStorefront(["https://evil.example/"]), false);
assert.equal(await revalidateStorefront([]), false);
