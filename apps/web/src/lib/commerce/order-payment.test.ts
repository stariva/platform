import { test } from "bun:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Моки заказов, ФНС и Ozon не должны влиять на другие наборы тестов.
for (const scenario of [
  "item loading failures claim the shipment and notify staff before rethrowing",
  "receipt preparation failures use the same shipment fallback",
  "fallback leaves another worker's shipment alone",
  "Ozon failures reuse the claimed attempt",
  "receipts are still processed when a shipment needs no new attempt",
  "successful shipment remains linked to its attempt",
]) {
  test(scenario, () => {
    const result = spawnSync(
      process.execPath,
      [
        "--no-env-file",
        fileURLToPath(
          new URL("../../../tests/fixtures/order-payment.ts", import.meta.url),
        ),
        scenario,
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}
