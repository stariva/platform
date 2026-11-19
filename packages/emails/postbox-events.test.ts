import { expect, test } from "bun:test";

import {
  parsePostboxEvent,
  parseStreamRecord,
  suppressionsOf,
} from "./postbox-events";

const mail = {
  timestamp: "2026-11-04T18:05:04+03:00",
  messageId: "msg-1",
  identityId: "identity",
  commonHeaders: { subject: "Тема", to: ["Ann@Example.test"] },
  headers: [
    { name: "List-Unsubscribe", value: "<https://stariva.test/api/m/u/t>" },
  ],
  tags: { "ses:configuration-set": ["stariva"] },
};

const delivery = {
  eventType: "Delivery",
  eventId: "ev-1",
  mail,
  delivery: {
    timestamp: "2026-11-04T18:05:14+03:00",
    recipients: ["Ann@Example.test"],
  },
};

const bounce = (bounceType: string) => ({
  eventType: "Bounce",
  eventId: "ev-2",
  mail,
  bounce: {
    bounceType,
    bounceSubType: "Undetermined",
    bouncedRecipients: [
      {
        emailAddress: "ann@example.test",
        diagnosticCode: "Host or MX not found",
      },
    ],
    timestamp: "2026-11-04T18:06:00+03:00",
  },
});

const complaint = (complaintFeedbackType?: string) => ({
  eventType: "Complaint",
  eventId: "ev-3",
  mail,
  complaint: {
    complainedRecipients: [{ emailAddress: "ann@example.test" }],
    ...(complaintFeedbackType ? { complaintFeedbackType } : {}),
    timestamp: "2026-11-05T09:00:00+03:00",
  },
});

test("parses a delivery with its own time and lower-cased recipients", () => {
  const event = parsePostboxEvent(delivery);
  expect(event).toMatchObject({
    eventId: "ev-1",
    messageId: "msg-1",
    type: "Delivery",
    recipients: ["ann@example.test"],
  });
  expect(event?.occurredAt.toISOString()).toBe("2026-11-04T15:05:14.000Z");
});

test("drops message headers: they carry personal links", () => {
  const event = parsePostboxEvent(delivery);
  const stored = event?.payload.mail as Record<string, unknown>;
  expect(stored).not.toHaveProperty("headers");
  expect(stored.commonHeaders).toEqual(mail.commonHeaders);
});

test("takes recipients from bounce, complaint and delay lists", () => {
  expect(parsePostboxEvent(bounce("Permanent"))?.recipients).toEqual([
    "ann@example.test",
  ]);
  expect(parsePostboxEvent(complaint())?.recipients).toEqual([
    "ann@example.test",
  ]);
  const delay = parsePostboxEvent({
    eventType: "DeliveryDelay",
    eventId: "ev-4",
    mail,
    deliveryDelay: {
      delayType: "General",
      delayedRecipients: [{ emailAddress: "b@example.test", status: "4.0.0" }],
      timestamp: "2026-11-04T18:10:00+03:00",
    },
  });
  expect(delay?.recipients).toEqual(["b@example.test"]);
});

test("falls back to the mail time when the event has none", () => {
  const event = parsePostboxEvent({
    eventType: "Send",
    eventId: "ev-5",
    mail,
    send: {},
  });
  expect(event?.occurredAt.toISOString()).toBe("2026-11-04T15:05:04.000Z");
  expect(event?.recipients).toEqual([]);
});

test("rejects notifications it cannot tie to a message", () => {
  expect(parsePostboxEvent(null)).toBeNull();
  expect(parsePostboxEvent({ eventType: "Delivery", eventId: "x" })).toBeNull();
  expect(
    parsePostboxEvent({ ...delivery, mail: { ...mail, messageId: "" } }),
  ).toBeNull();
  expect(parsePostboxEvent({ ...delivery, eventId: undefined })).toBeNull();
});

test("reads one notification, an array or newline-separated ones", () => {
  expect(parseStreamRecord(JSON.stringify(delivery)).events).toHaveLength(1);
  expect(
    parseStreamRecord(JSON.stringify([delivery, complaint()])).events,
  ).toHaveLength(2);
  const lines = parseStreamRecord(
    `${JSON.stringify(delivery)}\nnot json\n${JSON.stringify(complaint())}\n`,
  );
  expect(lines.events.map((event) => event.eventId)).toEqual(["ev-1", "ev-3"]);
  expect(lines.rejected).toBe(1);
  expect(parseStreamRecord('{"hello":1}')).toEqual({
    events: [],
    rejected: 1,
  });
});

test("suppresses permanent bounces and complaints, but not not-spam", () => {
  const of = (raw: unknown) => {
    const event = parsePostboxEvent(raw);
    if (!event) throw new Error("not parsed");
    return suppressionsOf(event);
  };
  expect(of(bounce("Permanent"))).toEqual([
    { email: "ann@example.test", reason: "bounced" },
  ]);
  expect(of(bounce("Transient"))).toEqual([]);
  expect(of(complaint())).toEqual([
    { email: "ann@example.test", reason: "complained" },
  ]);
  expect(of(complaint("abuse"))).toHaveLength(1);
  expect(of(complaint("not-spam"))).toEqual([]);
  expect(of(delivery)).toEqual([]);
});
