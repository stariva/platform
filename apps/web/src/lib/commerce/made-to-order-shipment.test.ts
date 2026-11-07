import { test } from "bun:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Моки заказов и Ozon не должны влиять на другие наборы тестов.
for (const scenario of [
  "until the Delivery API is connected the master bills by hand",
  "the quote uses the parcel, the point and the order value",
  "a quote is refused when the buyer changed the point meanwhile",
  "a buyer without a pickup point gets no quote",
  "an order out of production gets no quote",
  "a refused quote shows the reason and saves nothing",
  "an Ozon outage becomes a reason instead of an exception",
  "a paid order ships the saved parcel with a fresh quote",
  "an order nobody can claim is left alone",
  "a changed Ozon price is reported to the master",
  "a failed shipment is marked and retried by the webhook",
  "a parcel Ozon created but did not approve keeps its numbers and is not retried",
  "Ozon refusing the delivery at shipping time is a failure too",
  "a saved order without a parcel cannot ship",
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
