import { test } from "bun:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Isolate environment, database and provider mocks from other test modules.
for (const scenario of ["attached", "storage-fails"]) {
  test(`Workshop brief delivery: ${scenario}`, () => {
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(
          new URL(
            "./fixtures/workshop-brief-notifications.ts",
            import.meta.url,
          ),
        ),
        scenario,
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}
