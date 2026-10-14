import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// У фикстуры свои моки базы и fetch: держим их в отдельном процессе
test("Ozon stock push regression", () => {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../../tests/fixtures/ozon-stock.ts", import.meta.url),
      ),
    ],
    { encoding: "utf8", env: { ...process.env, CI: "true" } },
  );
  expect(result.status, result.stdout + result.stderr).toBe(0);
});
