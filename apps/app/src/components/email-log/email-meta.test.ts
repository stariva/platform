import assert from "node:assert/strict";
import { test } from "node:test";
import { deliveryState, times } from "./email-meta";

const none = {
  deliveredAt: null,
  delayedAt: null,
  bouncedAt: null,
  bounceDetail: null,
  complainedAt: null,
};
const at = (minute: number) => new Date(Date.UTC(2026, 10, 4, 15, minute));

test("доставка: самое важное событие — жалоба, потом отказ, доставка, задержка", () => {
  assert.equal(deliveryState(none), null);
  assert.equal(
    deliveryState({ ...none, delayedAt: at(1) })?.label,
    "Задерживается",
  );
  assert.equal(
    deliveryState({ ...none, delayedAt: at(1), deliveredAt: at(5) })?.label,
    "Доставлено",
  );
  const bounced = deliveryState({
    ...none,
    deliveredAt: at(5),
    bouncedAt: at(6),
    bounceDetail: "Host or MX not found",
  });
  assert.deepEqual(bounced, {
    label: "Не доставлено",
    variant: "destructive-light",
    at: at(6),
    detail: "Host or MX not found",
  });
  assert.equal(
    deliveryState({ ...none, deliveredAt: at(5), complainedAt: at(9) })?.label,
    "Жалоба на спам",
  );
});

test("раз, раза", () => {
  assert.deepEqual([1, 2, 4, 5, 11, 12, 21, 22, 104].map(times), [
    "раз",
    "раза",
    "раза",
    "раз",
    "раз",
    "раз",
    "раз",
    "раза",
    "раза",
  ]);
});
