import { expect, mock, test } from "bun:test";

test.skipIf(!process.env.NOTIFICATION_TEST_DATABASE_URL)(
  "notification leases recover interrupted deliveries and fence stale workers",
  async () => {
    const url = new URL(process.env.NOTIFICATION_TEST_DATABASE_URL ?? "");
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.pathname).toBe("/stariva_notification_test");
    process.env.POSTGRES_URL = url.href;
    const email = mock(async (_message: { idempotencyKey: string }) => {});
    const telegram = mock(async () => {});
    mock.module("@stariva/emails", () => ({
      sendEmail: email,
      StarivaWorkshopEmail: () => null,
    }));
    mock.module("@/lib/telegram/client-bot", () => ({
      isClientBotConfigured: () => true,
      sendClientMessage: telegram,
      escapeTelegramHtml: (text: string) => text,
      clientBotStartUrl: () => undefined,
    }));
    const { db } = await import("@stariva/db");
    const {
      orders,
      user,
      workshops,
      workshopOrderNotifications: notices,
    } = await import("@stariva/db/schema");
    const { eq, sql } = await import("drizzle-orm");
    const {
      claimOrderNotification: claim,
      completeOrderNotification: complete,
      releaseOrderNotification: release,
    } = await import("../payments/orders");
    const { notifyWorkshopBooked, runWorkshopReminderSweep } = await import(
      "./notifications"
    );
    const id = crypto.randomUUID();
    const now = new Date();
    await db
      .insert(user)
      .values({ id, name: "Test", email: `${id}@example.test` });
    try {
      await db.insert(workshops).values({
        id,
        slug: id,
        title: "Test",
        category: "interior",
        releaseAt: now,
      });
      await db.insert(orders).values({
        id,
        userId: id,
        workshopSlug: id,
        amount: 0,
        status: "paid",
        paidAt: new Date(now.getTime() - 3600_000),
        accessToken: id,
        telegramChatId: "synthetic-chat",
      });
      const read = async () =>
        db.select().from(notices).where(eq(notices.orderId, id));
      const expire = async () =>
        db
          .update(notices)
          .set({ leaseUntil: sql`now() - interval '1 second'` })
          .where(eq(notices.orderId, id));

      const claims = await Promise.all([
        claim(id, "booked", "email"),
        claim(id, "booked", "email"),
      ]);
      expect(claims.filter(Boolean)).toHaveLength(1);
      const first = claims.find((value) => value !== null);
      if (!first) throw new Error("missing claim");
      await notifyWorkshopBooked(id);
      expect(email).not.toHaveBeenCalled();
      await expire();
      const replacement = await claim(id, "booked", "email");
      expect(replacement).toBeTruthy();
      if (!replacement) throw new Error("missing replacement");
      expect(replacement).not.toBe(first);
      await complete(first);
      await release(first);
      expect((await read())[0]?.id).toBe(replacement);
      expect((await read())[0]?.sentAt).toBeNull();
      await release(replacement);

      email.mockRejectedValueOnce(new Error("provider failure"));
      await notifyWorkshopBooked(id);
      expect(await read()).toHaveLength(0);
      await notifyWorkshopBooked(id);
      expect(
        email.mock.calls.map(([message]) => message.idempotencyKey),
      ).toEqual([`workshop:${id}:booked:email`, `workshop:${id}:booked:email`]);
      expect((await read())[0]?.sentAt).toBeInstanceOf(Date);
      expect(await claim(id, "booked", "email")).toBeNull();
      // A late failure must not delete a completed delivery.
      const completedId = (await read())[0]?.id;
      if (completedId) await release(completedId);
      expect(await read()).toHaveLength(1);

      await claim(id, "release", "email");
      await claim(id, "release", "telegram");
      // Simulate interruption after Telegram accepted a message but before DB ack.
      await telegram();
      await expire();
      const result = await runWorkshopReminderSweep(now);
      expect(result).toEqual({ checked: 1, delivered: 2, failed: 0 });
      expect(telegram).toHaveBeenCalledTimes(2);
      expect(email.mock.calls.at(-1)?.[0].idempotencyKey).toBe(
        `workshop:${id}:release:email`,
      );
      expect((await read()).every((row) => row.sentAt !== null)).toBe(true);
      expect(await runWorkshopReminderSweep(now)).toEqual({
        checked: 1,
        delivered: 0,
        failed: 0,
      });
    } finally {
      await db.delete(user).where(eq(user.id, id));
      await db.delete(workshops).where(eq(workshops.id, id));
      mock.restore();
    }
  },
);
