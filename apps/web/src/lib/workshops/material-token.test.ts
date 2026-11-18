import assert from "node:assert/strict";
import { test } from "node:test";
import {
  grantedMaterialUser,
  signMaterialGrant,
  verifyMaterialGrant,
} from "./material-token";

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

test("a grant only opens the file and course it was issued for", () => {
  const token = signMaterialGrant(grant, SECRET);
  const open = (slug: string, file: string) =>
    grantedMaterialUser(token, SECRET, slug, file, NOW);
  assert.equal(open(grant.slug, grant.file), "user-1");
  assert.equal(open("other-course", grant.file), null);
  assert.equal(open(grant.slug, `${"b".repeat(64)}.pdf`), null);
  assert.equal(grantedMaterialUser(null, SECRET, grant.slug, grant.file), null);
  assert.equal(
    grantedMaterialUser(token, undefined, grant.slug, grant.file),
    null,
  );
});

test("grants with a malformed payload are refused", () => {
  const forged = signMaterialGrant(
    { ...grant, expiresAt: "soon" as unknown as number },
    SECRET,
  );
  assert.equal(verifyMaterialGrant(forged, SECRET, NOW), null);
});
