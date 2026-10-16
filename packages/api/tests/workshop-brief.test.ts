import { test } from "bun:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Keep provider mocks isolated from other router tests.
for (const scenario of [
  "single-sent",
  "single-mark-fails",
  "single-send-fails",
  "bulk-recovery",
  "bulk-idempotency",
]) {
  test(`Admin workshop brief: ${scenario}`, () => {
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL("./fixtures/workshop-brief.ts", import.meta.url)),
        scenario,
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}
