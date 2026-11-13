import { test } from "bun:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Моки каталога, Ozon и ЮKassa не должны влиять на другие наборы тестов.
for (const scenario of [
  "phone check is skipped when Ozon is down",
  "phone check still fails on an Ozon refusal",
  "quote falls back to free manual delivery when Ozon is down",
  "quote reports an Ozon refusal instead of going manual",
  "create takes the order with manual delivery when Ozon is down",
  "create refuses to charge more delivery than the buyer saw",
  "create goes ahead when the delivery price matches what the buyer saw",
  "create stays free when Ozon is down and the buyer expected a price",
  "create refuses a manual order that has no address for the point",
  "create reports delivery_unavailable when Ozon says no",
  "create does not go manual on an Ozon refusal",
]) {
  test(scenario, () => {
    const result = spawnSync(
      process.execPath,
      [
        "--no-env-file",
        fileURLToPath(
          new URL(
            "../../../tests/fixtures/checkout-services.ts",
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
