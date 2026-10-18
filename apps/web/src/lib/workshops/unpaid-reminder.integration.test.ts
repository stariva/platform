import { expect, mock, test } from "bun:test";
import type { YooKassaPayment } from "../payments/yookassa";

test.skipIf(!process.env.NOTIFICATION_TEST_DATABASE_URL)(
  "unpaid reminders respect buyer history and verified payments across orders",
  async () => {
    const url = new URL(process.env.NOTIFICATION_TEST_DATABASE_URL ?? "");
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.pathname).toBe("/stariva_notification_test");
    process.env.POSTGRES_URL = url.href;

    const emails = await import("@stariva/emails");
    const sendEmail = mock(async (_message: { to: string[] }) => {});
    mock.module("@stariva/emails", () => ({ ...emails, sendEmail }));
    mock.module("@/lib/workshops/notifications", () => ({
      siteUrl: () => "https://example.test",
      notifyWorkshopBooked: async () => {},
    }));
    const pending: YooKassaPayment = {
      id: "synthetic-payment",
      status: "pending",
      paid: false,
      amount: { value: "100.00", currency: "RUB" },
    };
    const payments = new Map<string, YooKassaPayment | Error>();
    const lookupPayment = async (id: string) => {
      const payment = payments.get(id) ?? { ...pending, id };
      if (payment instanceof Error) throw payment;
      return payment;
    };
    const getPayment = mock(lookupPayment);
    mock.module("@/lib/payments/yookassa", () => ({ getPayment }));

    const { db } = await import("@stariva/db");
    const {
      courseAccess,
      orders,
      user,
      workshops,
      workshopOrderNotifications,
    } = await import("@stariva/db/schema");
    const { eq, inArray } = await import("drizzle-orm");
    const { runUnpaidOrderSweep } = await import("./unpaid-reminder");
    const now = new Date("2026-10-18T12:00:00Z");
    const prefix = crypto.randomUUID();
    const userIds = [`${prefix}-buyer`, `${prefix}-other`] as const;
    const slug = `${prefix}-workshop`;
    const otherSlug = `${prefix}-other-workshop`;
    const email = `${prefix}@example.test`;
    await db.insert(user).values(
      userIds.map((id) => ({
        id,
        name: "Test",
        email: `${id}@example.test`,
      })),
    );
    try {
      await db.insert(workshops).values(
        [slug, otherSlug].map((slug) => ({
          slug,
          title: "Test",
          category: "interior" as const,
          status: "published" as const,
          price: 10000,
        })),
      );
      const addOrder = async (
        over: Partial<typeof orders.$inferInsert> = {},
      ) => {
        const id = crypto.randomUUID();
        await db.insert(orders).values({
          id,
          userId: userIds[0],
          workshopSlug: slug,
          amount: 10000,
          status: "pending",
          contactEmail: email,
          createdAt: new Date(now.getTime() - 90 * 60_000),
          ...over,
        });
        return id;
      };
      const reset = async () => {
        await db
          .delete(courseAccess)
          .where(inArray(courseAccess.userId, userIds));
        await db.delete(orders).where(inArray(orders.userId, userIds));
        sendEmail.mockClear();
        getPayment.mockReset();
        getPayment.mockImplementation(lookupPayment);
        payments.clear();
      };
      const check = async (delivered: number) => {
        expect(await runUnpaidOrderSweep(now)).toMatchObject({
          delivered,
          failed: 0,
        });
        expect(sendEmail).toHaveBeenCalledTimes(delivered);
      };
      const old = new Date(now.getTime() - 48 * 3600_000);

      // History survives the daily window, matching either account or email.
      for (const sameAccount of [true, false]) {
        await reset();
        const previous = await addOrder({
          createdAt: old,
          userId: sameAccount ? userIds[0] : userIds[1],
          contactEmail: sameAccount ? "old@example.test" : email.toUpperCase(),
        });
        await db.insert(workshopOrderNotifications).values({
          orderId: previous,
          kind: "unpaid",
          channel: "email",
          sentAt: old,
        });
        await addOrder();
        await check(0);
      }

      // Incomplete, other-channel/kind, other-buyer and other-course notices
      // must not suppress an otherwise eligible recipient.
      for (const variant of ["unsent", "channel", "kind", "buyer", "course"]) {
        await reset();
        const previous = await addOrder({
          createdAt: old,
          userId: variant === "buyer" ? userIds[1] : userIds[0],
          contactEmail: variant === "buyer" ? "other@example.test" : email,
          workshopSlug: variant === "course" ? otherSlug : slug,
        });
        await db.insert(workshopOrderNotifications).values({
          orderId: previous,
          kind: variant === "kind" ? "booked" : "unpaid",
          channel: variant === "channel" ? "telegram" : "email",
          sentAt: variant === "unsent" ? null : old,
        });
        await addOrder({ paymentId: "confirmed-pending" });
        await check(1);
        sendEmail.mockClear();
        await check(0);
      }

      // A lost webhook on any older attempt suppresses the buyer's retry.
      for (const sameAccount of [true, false]) {
        await reset();
        const previous = await addOrder({
          createdAt: old,
          userId: sameAccount ? userIds[0] : userIds[1],
          contactEmail: sameAccount ? "old@example.test" : email.toUpperCase(),
          paymentId: "paid-previous-attempt",
        });
        payments.set("paid-previous-attempt", {
          ...pending,
          id: "paid-previous-attempt",
          status: "succeeded",
          paid: true,
        });
        await addOrder({ status: "canceled" });
        await check(0);
        expect(
          (await db.select().from(orders).where(eq(orders.id, previous)))[0]
            ?.status,
        ).toBe("paid");
      }

      // Failed checks defer only the affected buyer; a later run can retry.
      for (const sibling of [true, false]) {
        await reset();
        payments.set("unavailable", new Error("synthetic provider outage"));
        await addOrder({
          createdAt: sibling ? old : new Date(now.getTime() - 90 * 60_000),
          paymentId: "unavailable",
        });
        if (sibling) await addOrder({ status: "canceled" });
        await addOrder({
          userId: userIds[1],
          contactEmail: "unaffected@example.test",
          status: "canceled",
        });
        await check(1);
        expect(sendEmail.mock.calls[0]?.[0].to).toEqual([
          "unaffected@example.test",
        ]);
        payments.clear();
        sendEmail.mockClear();
        await check(1);
        expect(sendEmail.mock.calls[0]?.[0].to).toEqual([email]);
      }

      // Rechecking immediately before delivery can fail after the first check.
      await reset();
      await addOrder({ paymentId: "late-failure" });
      getPayment
        .mockResolvedValueOnce(pending)
        .mockRejectedValueOnce(new Error("synthetic late outage"));
      await check(0);
      expect(getPayment).toHaveBeenCalledTimes(2);
    } finally {
      await db.delete(user).where(inArray(user.id, userIds));
      await db
        .delete(workshops)
        .where(inArray(workshops.slug, [slug, otherSlug]));
      mock.restore();
    }
  },
);
