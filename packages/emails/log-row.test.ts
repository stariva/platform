import { expect, test } from "bun:test";

import { emailContext, emailLogRow, errorText } from "./log-row";

const base = {
  to: ["a@example.test", "b@example.test"],
  subject: "Тема",
  attachments: 1,
  durationMs: 120,
};

test("takes the order and kind from a workshop idempotency key", () => {
  expect(emailContext("workshop:4170ebb5:booked:email")).toEqual({
    workshopOrderId: "4170ebb5",
    kind: "booked",
  });
  expect(emailContext("receipt:1")).toEqual({});
  expect(emailContext(undefined)).toEqual({});
});

test("marks the email sent by the first provider that accepted it", () => {
  const row = emailLogRow({
    ...base,
    idempotencyKey: "workshop:o1:brief:email",
    attempts: [
      { provider: "resend", ok: false, error: "fetch failed", ms: 15000 },
      { provider: "postbox", ok: true, ms: 400 },
    ],
  });
  expect(row).toMatchObject({
    recipient: "a@example.test, b@example.test",
    status: "sent",
    provider: "postbox",
    error: null,
    workshopOrderId: "o1",
    kind: "brief",
    attachments: 1,
  });
  expect(row.attempts).toHaveLength(2);
});

test("marks the email failed with the last provider's error", () => {
  const row = emailLogRow({
    ...base,
    attempts: [
      { provider: "resend", ok: false, error: "first", ms: 10 },
      { provider: "postbox", ok: false, error: "second", ms: 20 },
    ],
  });
  expect(row).toMatchObject({
    status: "failed",
    provider: "postbox",
    error: "second",
    idempotencyKey: null,
  });
});

test("keeps the email html in the row, empty when it was not rendered", () => {
  const attempts = [{ provider: "resend", ok: true, ms: 10 }];
  expect(emailLogRow({ ...base, attempts, html: "<p>Привет</p>" }).html).toBe(
    "<p>Привет</p>",
  );
  expect(emailLogRow({ ...base, attempts }).html).toBeNull();
});

test("cuts long provider errors", () => {
  expect(errorText(new Error("x".repeat(900)))).toHaveLength(500);
  expect(errorText("plain")).toBe("plain");
});
