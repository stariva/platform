import assert from "node:assert/strict";
import { test } from "node:test";
import { signMaterialGrant, verifyMaterialGrant } from "./material-token";

const SECRET = "test-secret-test-secret-test-secret";
const NOW = 1_800_000_000;
const grant = {
  slug: "elka-makrame",
  file: `${"a".repeat(64)}.pdf`,
  userId: "user-1",
  expiresAt: NOW + 300,
};

test("a signed material grant round-trips", () => {
  const token = signMaterialGrant(grant, SECRET);
  assert.match(token, /^[\w-]+\.[\w-]+$/, "token is safe inside a URL query");
  assert.deepEqual(verifyMaterialGrant(token, SECRET, NOW), grant);
});

test("expired material grants are refused", () => {
  const token = signMaterialGrant(grant, SECRET);
  assert.equal(verifyMaterialGrant(token, SECRET, grant.expiresAt), null);
});

test("tampered or foreign material grants are refused", () => {
  const token = signMaterialGrant(grant, SECRET);
  assert.equal(
    verifyMaterialGrant(token, "another-secret-another-secret", NOW),
    null,
  );

  const [, sig] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({ ...grant, u: "user-2" }),
  ).toString("base64url");
  assert.equal(verifyMaterialGrant(`${forged}.${sig}`, SECRET, NOW), null);

  assert.equal(verifyMaterialGrant("garbage", SECRET, NOW), null);
  assert.equal(verifyMaterialGrant(".", SECRET, NOW), null);
});
