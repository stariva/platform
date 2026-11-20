import { test } from "bun:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("paid bundles retry extra access even after the preorder period", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--no-env-file",
      fileURLToPath(
        new URL(
          "../../../tests/fixtures/workshop-order-payment.ts",
          import.meta.url,
        ),
      ),
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
