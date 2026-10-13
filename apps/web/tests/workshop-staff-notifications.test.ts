import { test } from "bun:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Isolate environment, database and provider mocks from other test modules.
for (const scenario of [
  "telegram-fails",
  "email-fails",
  "both-fail",
  "telegram-only",
  "email-only",
  "unconfigured",
  "concurrent",
]) {
  test(`Workshop staff delivery: ${scenario}`, () => {
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(
          new URL(
            "./fixtures/workshop-staff-notifications.ts",
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
