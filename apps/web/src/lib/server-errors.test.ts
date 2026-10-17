import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseLogArgs,
  requestProperties,
  sanitizeError,
} from "./server-errors";

test("sanitizeError hides emails and phones in message and stack", () => {
  const error = new Error("duplicate key for anna@example.com");
  error.stack = `Error: ${error.message}\n    at call +7 (999) 123-45-67`;
  const safe = sanitizeError(error);
  assert.equal(safe.message, "duplicate key for ***");
  assert.ok(!safe.stack?.includes("anna@example.com"));
  assert.ok(!safe.stack?.includes("123-45-67"));
});

test("sanitizeError wraps non-Error values", () => {
  assert.equal(sanitizeError("boom").message, "boom");
});

test("requestProperties drops query and hides secret ids", () => {
  const properties = requestProperties(
    { path: "/api/workshops/access/abc123?token=secret", method: "POST" },
    { routePath: "/api/workshops/access/[token]", routeType: "route" },
  );
  assert.deepEqual(properties, {
    request_path: "/api/workshops/access/:token",
    request_method: "POST",
    route_path: "/api/workshops/access/[token]",
    route_type: "route",
  });
});

test("parseLogArgs keeps the original Error and masks the log text", () => {
  const error = new Error("fail");
  const parsed = parseLogArgs(["[checkout] Ошибка для a@b.ru", error]);
  assert.equal(parsed.error, error);
  assert.equal(parsed.text, "[checkout] Ошибка для *** Error: fail");
});

test("parseLogArgs builds an Error from a plain message", () => {
  const parsed = parseLogArgs(["[custom-order] retry_worker_failed"]);
  assert.ok(parsed.error instanceof Error);
  assert.equal(parsed.error.message, "[custom-order] retry_worker_failed");
});
