import { mock } from "bun:test";
import assert from "node:assert/strict";

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
let timeout = 0;
const realTimeout = AbortSignal.timeout;
AbortSignal.timeout = (ms) => {
  timeout = ms;
  return realTimeout(ms);
};
globalThis.fetch = mock(async (url, options) => {
  calls++;
  assert.equal(new URL(String(url)).protocol, "https:");
  assert.equal(options?.method, "POST");
  assert.equal(
    new Headers(options?.headers).get("authorization"),
    "Bearer fixture",
  );
  return Response.json(body);
}) as unknown as typeof fetch;
assert.equal(await pushStorefrontStockToOzon(["vase"]), true);
assert.ok(timeout > 20_000);
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
assert.equal(await revalidateStorefront(["/"]), true);
