import { test } from "bun:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Моки заказов и Ozon не должны влиять на другие наборы тестов.
for (const scenario of [
  "the quote holds stock before asking Ozon for a price",
  "two sizes of one product become one Ozon line",
  "a buyer without a pickup point gets no quote and no stock",
  "a product without an Ozon SKU points to the manual path",
  "stock Ozon has not accepted stops before the price",
  "a refused quote saves nothing and asks to retry",
  "an Ozon outage becomes a reason instead of an exception",
  "a paid order is shipped with a fresh quote",
  "an order nobody can claim is left alone",
  "a changed Ozon price is reported to the master",
  "a failed shipment is marked and retried by the webhook",
  "Ozon refusing the delivery at shipping time is a failure too",
]) {
  test(scenario, () => {
    const result = spawnSync(
      process.execPath,
      [
        "--no-env-file",
        fileURLToPath(
          new URL(
            "../../../tests/fixtures/made-to-order-shipment.ts",
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
