import assert from "node:assert/strict";
import { test } from "node:test";
import { jwtExpiryMs } from "./jwt-expiry";

function jwt(payload: unknown) {
  const part = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(payload)}.signature`;
}

test("reads exp from a JWT in milliseconds", () => {
  assert.equal(jwtExpiryMs(jwt({ exp: 1_800_000_000 })), 1_800_000_000_000);
});

test("returns null for tokens without a usable exp", () => {
  assert.equal(jwtExpiryMs(jwt({ sub: "1" })), null);
  assert.equal(jwtExpiryMs(jwt({ exp: "soon" })), null);
  assert.equal(jwtExpiryMs("opaque-token"), null);
  assert.equal(jwtExpiryMs("a.%%%.c"), null);
  assert.equal(jwtExpiryMs(""), null);
});
