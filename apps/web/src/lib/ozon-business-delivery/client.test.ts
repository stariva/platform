import { test } from "bun:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Набор подменяет `@/env` на весь процесс, поэтому идёт отдельным процессом
// bun: подмена не должна влиять на другие тесты (например, на npd/client).
test("the Ozon business delivery client", () => {
  const result = spawnSync(
    process.execPath,
    [
      "test",
      "--no-env-file",
      fileURLToPath(
        new URL(
          "../../../tests/fixtures/ozon-business-delivery-client.ts",
          import.meta.url,
        ),
      ),
    ],
    {
      encoding: "utf8",
      cwd: fileURLToPath(new URL("../../..", import.meta.url)),
    },
  );
  const output = result.stdout + result.stderr;
  assert.equal(result.status, 0, output);
  // Если bun не нашёл тестов (например, из-за пути), он тоже завершается с 0
  const passed = Number(/^\s*(\d+) pass$/m.exec(output)?.[1] ?? 0);
  assert.ok(passed > 0, `ни один тест не выполнился:\n${output}`);
});
