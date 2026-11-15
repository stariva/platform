import assert from "node:assert/strict";
import { test } from "node:test";
import { shipsFromHandlingDays, shipsFromLabel } from "./in-stock";

const SLUG = "nabor-makrame-elka";

test("до даты отправки показываем «18 ноября»", () => {
  const now = new Date("2026-11-15T12:00:00+03:00");
  assert.equal(shipsFromLabel(SLUG, now), "18 ноября");
});

test("в день отправки подпись пропадает", () => {
  assert.equal(
    shipsFromLabel(SLUG, new Date("2026-11-17T23:59:59+03:00")),
    "18 ноября",
  );
  assert.equal(
    shipsFromLabel(SLUG, new Date("2026-11-18T00:00:00+03:00")),
    null,
  );
  assert.equal(shipsFromLabel(SLUG, new Date("2027-01-01T00:00:00Z")), null);
});

test("у других товаров подписи нет", () => {
  const now = new Date("2026-11-15T12:00:00+03:00");
  assert.equal(shipsFromLabel("abazhur-makrame-4756", now), null);
  assert.equal(shipsFromHandlingDays("abazhur-makrame-4756", now), null);
});

test("срок в днях для разметки: до даты и ещё два дня", () => {
  const now = new Date("2026-11-15T12:00:00+03:00");
  assert.deepEqual(shipsFromHandlingDays(SLUG, now), { min: 3, max: 5 });
  assert.equal(
    shipsFromHandlingDays(SLUG, new Date("2026-11-19T00:00:00+03:00")),
    null,
  );
});
