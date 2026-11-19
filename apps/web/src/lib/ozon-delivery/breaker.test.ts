import assert from "node:assert/strict";
import { test } from "node:test";
import { createBreaker } from "./breaker";
import { isInfrastructureStatus } from "./errors";

function breakerWithClock(threshold = 3, cooldownMs = 30_000) {
  const clock = { now: 1_000 };
  const breaker = createBreaker({
    threshold,
    cooldownMs,
    now: () => clock.now,
  });
  return { breaker, clock };
}

test("opens only after the threshold of consecutive failures", () => {
  const { breaker } = breakerWithClock();
  breaker.recordFailure();
  breaker.recordFailure();
  assert.equal(breaker.isOpen(), false);
  breaker.recordFailure();
  assert.equal(breaker.isOpen(), true);
});

test("a success in between resets the counter", () => {
  const { breaker } = breakerWithClock();
  breaker.recordFailure();
  breaker.recordFailure();
  breaker.recordSuccess();
  breaker.recordFailure();
  breaker.recordFailure();
  assert.equal(breaker.isOpen(), false);
});

test("lets a probe through after the cooldown and reopens on failure", () => {
  const { breaker, clock } = breakerWithClock(2, 10_000);
  breaker.recordFailure();
  breaker.recordFailure();
  assert.equal(breaker.isOpen(), true);

  clock.now += 10_000;
  assert.equal(breaker.isOpen(), false);
  breaker.recordFailure();
  assert.equal(breaker.isOpen(), true);

  clock.now += 10_000;
  breaker.recordSuccess();
  assert.equal(breaker.isOpen(), false);
});

test("treats keys, limits and server errors as infrastructure", () => {
  for (const status of [401, 403, 408, 429, 500, 502, 503]) {
    assert.equal(isInfrastructureStatus(status), true, String(status));
  }
  for (const status of [400, 404, 409, 422]) {
    assert.equal(isInfrastructureStatus(status), false, String(status));
  }
});
