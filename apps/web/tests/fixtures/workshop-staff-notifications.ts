import { mock } from "bun:test";
import assert from "node:assert/strict";
import { workshopOrderNotifications } from "@stariva/db/schema";
import type { NotificationChannel } from "../../src/lib/payments/orders";

const scenario = process.argv[2];
const now = new Date();
const target = {
  order: {
    id: "synthetic-order",
    amount: 249000,
    paidAt: now,
    createdAt: now,
    accessToken: "synthetic-access",
    telegramChatId: null,
    telegramToken: null,
  },
  workshop: {
    slug: "test",
    title: "Test",
    releaseAt: null,
    materials: [],
    materialFiles: [],
  },
  email: "buyer@example.test",
};
const telegramConfigured = !["email-only", "unconfigured"].includes(
  scenario ?? "",
);
const emailConfigured = !["telegram-only", "unconfigured"].includes(
  scenario ?? "",
);
mock.module("../../src/env", () => ({
  env: {
    TELEGRAM_BOT_TOKEN: telegramConfigured ? "synthetic-token" : undefined,
    TELEGRAM_CHAT_ID: telegramConfigured ? "synthetic-chat" : undefined,
    ORDER_EMAIL_FROM: "from@example.test",
    ORDER_EMAIL_TO: emailConfigured ? "staff@example.test" : undefined,
  },
  baseEnv: { RESEND_API_KEY: "synthetic-key", APP_URL: "https://example.test" },
}));
mock.module("../../src/lib/custom-order/inbox", () => ({
  notificationConfigured: () => telegramConfigured || emailConfigured,
}));
const loggedChannels: unknown[] = [];
mock.module("@stariva/config", () => ({
  logger: {
    // Та же сигнатура, что у настоящего logger.error: событие, ошибка, детали
    error: (_event: string, _error?: unknown, details?: { channel?: string }) =>
      loggedChannels.push(details?.channel),
  },
}));
let buyerEmails = 0;
const StarivaWorkshopEmail = () => null;
mock.module("@stariva/emails", () => ({
  StarivaWorkshopEmail,
  sendEmail: async () => {
    buyerEmails++;
  },
  sendWorkshopBriefEmail: async () => {},
}));
mock.module("@stariva/storage", () => ({
  loadWorkshopMaterials: async () => [],
}));

interface Notice {
  id: string;
  orderId: string;
  kind: string;
  channel: NotificationChannel;
  sentAt: Date | null;
}
const notices = new Map<string, Notice>();
mock.module("@stariva/db", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => {
        const query = {
          innerJoin: () => query,
          where: async () =>
            table === workshopOrderNotifications
              ? [...notices.values()]
              : [target],
        };
        return query;
      },
    }),
  },
}));
mock.module("../../src/lib/payments/orders", () => ({
  claimOrderNotification: async (
    orderId: string,
    kind: string,
    channel: NotificationChannel,
  ) => {
    const key = `${orderId}:${kind}:${channel}`;
    if (notices.has(key)) return null;
    notices.set(key, { id: key, orderId, kind, channel, sentAt: null });
    return key;
  },
  completeOrderNotification: async (id: string) => {
    const notice = notices.get(id);
    assert.ok(notice);
    notice.sentAt = now;
  },
  releaseOrderNotification: async (id: string) => {
    notices.delete(id);
  },
  markOrderNotificationSent: async () => {},
}));

const attempts = { telegram: 0, email: 0 };
let failTelegram = ["telegram-fails", "both-fail"].includes(scenario ?? "");
let failEmail = ["email-fails", "both-fail"].includes(scenario ?? "");
// Exercise the real delivery helper, with synthetic HTTP responses.
globalThis.fetch = mock(async (url, options) => {
  if (String(url).startsWith("https://api.telegram.org/")) {
    attempts.telegram++;
    return Response.json({ ok: !failTelegram });
  }
  assert.equal(String(url), "https://api.resend.com/emails");
  assert.equal(
    new Headers(options?.headers).get("Idempotency-Key"),
    "workshop-purchase/synthetic-order",
  );
  attempts.email++;
  return Response.json(failEmail ? { error: "failure" } : { id: "receipt" });
}) as unknown as typeof fetch;

const { notifyWorkshopBooked, runWorkshopReminderSweep } = await import(
  "../../src/lib/workshops/notifications"
);
const failures = Number(failTelegram) + Number(failEmail);
await notifyWorkshopBooked(target.order.id);
assert.deepEqual(attempts, {
  telegram: Number(telegramConfigured),
  email: Number(emailConfigured),
});
const sentChannels = () =>
  [...notices.values()]
    .filter((notice) => notice.sentAt !== null)
    .map((notice) => notice.channel)
    .sort();
assert.deepEqual(sentChannels(), [
  "email",
  ...(emailConfigured && !failEmail ? ["staff-email"] : []),
  ...(telegramConfigured && !failTelegram ? ["staff-telegram"] : []),
]);
if (failTelegram) assert.ok(loggedChannels.includes("staff-telegram"));
if (failEmail) assert.ok(loggedChannels.includes("staff-email"));

// The sweep retries failures even when another staff channel is completed.
assert.deepEqual(await runWorkshopReminderSweep(now), {
  checked: 1,
  delivered: 0,
  failed: failures,
});
const retryChannels = {
  telegram: Number(failTelegram),
  email: Number(failEmail),
};
failTelegram = false;
failEmail = false;
const beforeRecovery = { ...attempts };
if (scenario === "concurrent") {
  notices.clear();
  attempts.telegram = attempts.email = 0;
  await Promise.all([
    notifyWorkshopBooked(target.order.id),
    notifyWorkshopBooked(target.order.id),
    runWorkshopReminderSweep(now),
  ]);
  assert.deepEqual(attempts, { telegram: 1, email: 1 });
} else {
  assert.deepEqual(await runWorkshopReminderSweep(now), {
    checked: 1,
    delivered: failures,
    failed: 0,
  });
  assert.deepEqual(attempts, {
    telegram: beforeRecovery.telegram + retryChannels.telegram,
    email: beforeRecovery.email + retryChannels.email,
  });
}

const completedAttempts = { ...attempts };
await notifyWorkshopBooked(target.order.id);
assert.deepEqual(await runWorkshopReminderSweep(now), {
  checked: 1,
  delivered: 0,
  failed: 0,
});
assert.deepEqual(attempts, completedAttempts);
assert.equal(buyerEmails, scenario === "concurrent" ? 2 : 1);
