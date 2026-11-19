import assert from "node:assert/strict";
import { test } from "node:test";
import { sessionFingerprint, signHlsGrant, verifyHlsGrant } from "./hls-token";

const SECRET = "test-secret-test-secret-test-secret";
const NOW = 1_800_000_000;
const grant = {
  prefix: "workshops/poyas/hls/lesson-1-0a1b2c3d4e",
  expiresAt: NOW + 3600,
  session: sessionFingerprint("session-token.signature"),
  storage: null,
};

test("a signed grant round-trips", () => {
  const token = signHlsGrant(grant, SECRET);
  assert.match(token, /^[\w-]+\.[\w-]+$/, "token is safe inside a URL path");
  assert.deepEqual(verifyHlsGrant(token, SECRET, NOW), grant);
});

test("expired grants are refused", () => {
  const token = signHlsGrant(grant, SECRET);
  assert.equal(verifyHlsGrant(token, SECRET, grant.expiresAt), null);
});

test("tampered or foreign grants are refused", () => {
  const token = signHlsGrant(grant, SECRET);
  assert.equal(
    verifyHlsGrant(token, "another-secret-another-secret", NOW),
    null,
  );

  const [, sig] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({ p: "workshops/other/hls/x", e: NOW + 3600, s: null }),
  ).toString("base64url");
  assert.equal(verifyHlsGrant(`${forged}.${sig}`, SECRET, NOW), null);

  assert.equal(verifyHlsGrant("garbage", SECRET, NOW), null);
  assert.equal(verifyHlsGrant(".", SECRET, NOW), null);
});

test("a grant pins the storage its video is watched from", () => {
  const token = signHlsGrant({ ...grant, storage: "vkcloud" }, SECRET);
  assert.equal(verifyHlsGrant(token, SECRET, NOW)?.storage, "vkcloud");
});

test("grants issued before the mirror keep reading the active storage", () => {
  const [, sig] = signHlsGrant({ ...grant, storage: null }, SECRET).split(".");
  // Поле t отсутствует — как в пропусках, выданных до появления зеркала
  const legacy = Buffer.from(
    JSON.stringify({ p: grant.prefix, e: grant.expiresAt, s: grant.session }),
  ).toString("base64url");
  assert.deepEqual(verifyHlsGrant(`${legacy}.${sig}`, SECRET, NOW), {
    ...grant,
    storage: null,
  });
});

test("an unknown storage in a grant is refused", () => {
  const [, sig] = signHlsGrant(grant, SECRET).split(".");
  const forged = Buffer.from(
    JSON.stringify({
      p: grant.prefix,
      e: grant.expiresAt,
      s: grant.session,
      t: "somewhere-else",
    }),
  ).toString("base64url");
  assert.equal(verifyHlsGrant(`${forged}.${sig}`, SECRET, NOW), null);
});

test("session fingerprints hide the cookie and tell browsers apart", () => {
  const a = sessionFingerprint("token-a.sig");
  assert.ok(a && !a.includes("token-a"));
  assert.notEqual(a, sessionFingerprint("token-b.sig"));
  assert.equal(sessionFingerprint(null), null);
  assert.equal(sessionFingerprint(""), null);
});

test("previews without sign-in carry no session", () => {
  const token = signHlsGrant({ ...grant, session: null }, SECRET);
  assert.equal(verifyHlsGrant(token, SECRET, NOW)?.session, null);
});
