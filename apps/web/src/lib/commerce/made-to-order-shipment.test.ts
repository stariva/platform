import { test } from "bun:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Моки заказов и Ozon не должны влиять на другие наборы тестов.
for (const scenario of [
  "the delivery is priced for the chosen point and saved together with it",
  "a point Ozon refuses is for the buyer to change, the master is not bothered",
  "a refusal that is not about the point alerts the master to bill by hand",
  "an Ozon outage asks the buyer to retry and does not alert the master",
  "until the Delivery API is connected the master is told to bill by hand",
  "an order that no longer waits for the balance is locked",
  "an order billed by hand has no parcel and asks for no point",
  "a price that lost the race to a payment is not saved as done",
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
