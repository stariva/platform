import { test } from "bun:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Each fixture has its own module mocks; keep them out of other test modules.
for (const fixture of [
  "stock-push",
  "storefront",
  "set-stock",
  "split-reason",
]) {
  test(`Ozon stock regression: ${fixture}`, () => {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL(`./fixtures/${fixture}.ts`, import.meta.url))],
      { encoding: "utf8", env: { ...process.env, CI: "true" } },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}

test("storefront configuration accepts only HTTPS", () => {
  for (const [url, accepted] of [
    ["https://store.example", true],
    ["http://store.example", false],
    ["ftp://store.example", false],
  ] as const) {
    const result = spawnSync(
      process.execPath,
      ["-e", 'await import("./packages/config/src/env.ts")'],
      {
        cwd: new URL("../../..", import.meta.url),
        env: {
          ...process.env,
          CI: "",
          npm_lifecycle_event: "test",
          STOREFRONT_URL: url,
        },
        encoding: "utf8",
      },
    );
    assert.equal(result.status === 0, accepted, result.stdout + result.stderr);
  }
});
