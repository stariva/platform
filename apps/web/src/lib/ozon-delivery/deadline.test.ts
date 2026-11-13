import assert from "node:assert/strict";
import { test } from "node:test";
import { withDeadline } from "./deadline";

const timeout = () => new Error("timeout");

test("passes the result through when it arrives in time", async () => {
  const signal = AbortSignal.timeout(500);
  assert.equal(
    await withDeadline(Promise.resolve("ok"), signal, timeout),
    "ok",
  );
});

test("passes the failure through when it arrives in time", async () => {
  const signal = AbortSignal.timeout(500);
  await assert.rejects(
    withDeadline(Promise.reject(new Error("boom")), signal, timeout),
    /boom/,
  );
});

test("stops waiting at the deadline but leaves the shared promise running", async () => {
  let settled = false;
  const shared = new Promise<string>((resolve) =>
    setTimeout(() => {
      settled = true;
      resolve("late");
    }, 60),
  );
  const signal = AbortSignal.timeout(10);
  await assert.rejects(withDeadline(shared, signal, timeout), /timeout/);
  assert.equal(settled, false);
  // Другие покупатели продолжают ждать то же обновление и получают результат
  assert.equal(await shared, "late");
});

test("an already expired deadline fails at once", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    withDeadline(new Promise<never>(() => {}), controller.signal, timeout),
    /timeout/,
  );
});
