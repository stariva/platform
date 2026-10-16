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
    materialFiles: [{ label: "Бриф", key: "workshops/test/materials/b.pdf" }],
  },
  email: "buyer@example.test",
};
mock.module("../../src/env", () => ({
  env: {},
  baseEnv: { APP_URL: "https://example.test" },
}));
mock.module("../../src/lib/custom-order/inbox", () => ({
  notificationConfigured: () => false,
}));
mock.module("@stariva/config", () => ({ logger: { error: () => {} } }));

const pdf = {
  label: "Бриф",
  filename: "Бриф.pdf",
  content: Buffer.from("%PDF"),
};
let storageFails = scenario === "storage-fails";
mock.module("@stariva/storage", () => ({
  loadWorkshopMaterials: async () => {
    if (storageFails) throw new Error("storage down");
    return [pdf];
  },
}));
const bookedEmails: Array<{
  idempotencyKey: string;
  attachments: unknown[];
}> = [];
const briefEmails: Array<{ idempotencyKey: string; files: unknown[] }> = [];
mock.module("@stariva/emails", () => ({
  StarivaWorkshopEmail: () => null,
  sendEmail: async (email: (typeof bookedEmails)[number]) => {
    bookedEmails.push(email);
  },
  sendWorkshopBriefEmail: async (email: (typeof briefEmails)[number]) => {
    briefEmails.push(email);
  },
}));

const sent = new Map<string, Date | null>();
mock.module("@stariva/db", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => {
        const query = {
          innerJoin: () => query,
          where: async () =>
            table === workshopOrderNotifications
              ? [...sent].map(([key, sentAt]) => {
                  const [orderId, kind, channel] = key.split(":");
                  return { orderId, kind, channel, sentAt };
                })
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
    if (sent.has(key)) return null;
    sent.set(key, null);
    return key;
  },
  completeOrderNotification: async (key: string) => {
    sent.set(key, now);
  },
  releaseOrderNotification: async (key: string) => {
    sent.delete(key);
  },
  markOrderNotificationSent: async (
    orderId: string,
    kind: string,
    channel: NotificationChannel,
  ) => {
    sent.set(`${orderId}:${kind}:${channel}`, now);
  },
}));

const { notifyWorkshopBooked, runWorkshopReminderSweep } = await import(
  "../../src/lib/workshops/notifications"
);
await notifyWorkshopBooked(target.order.id);
assert.equal(bookedEmails.length, 1);

if (scenario === "attached") {
  // Бриф ушёл вложением в письме о покупке — отдельно его не шлём
  assert.deepEqual(bookedEmails[0]?.attachments, [
    { filename: pdf.filename, content: pdf.content },
  ]);
  assert.equal(sent.get("synthetic-order:brief:email"), now);
  assert.deepEqual(await runWorkshopReminderSweep(now), {
    checked: 1,
    delivered: 0,
    failed: 0,
  });
  assert.equal(briefEmails.length, 0);
} else {
  // Хранилище не ответило — письмо о покупке всё равно ушло, без брифа
  assert.deepEqual(bookedEmails[0]?.attachments, []);
  assert.equal(sent.has("synthetic-order:brief:email"), false);
  storageFails = false;
  assert.deepEqual(await runWorkshopReminderSweep(now), {
    checked: 1,
    delivered: 1,
    failed: 0,
  });
  assert.equal(briefEmails.length, 1);
  assert.equal(
    briefEmails[0]?.idempotencyKey,
    "workshop:synthetic-order:brief:email",
  );
  assert.deepEqual(briefEmails[0]?.files, [pdf]);
  assert.equal(sent.get("synthetic-order:brief:email"), now);
  assert.deepEqual(await runWorkshopReminderSweep(now), {
    checked: 1,
    delivered: 0,
    failed: 0,
  });
}
