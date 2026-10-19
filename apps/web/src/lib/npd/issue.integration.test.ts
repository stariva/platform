import { expect, mock, spyOn, test } from "bun:test";
import type { YooKassaPayment } from "../payments/yookassa";

test.skipIf(!process.env.NPD_TEST_DATABASE_URL)(
  "auto receipts are issued once per payment and never duplicated",
  async () => {
    const url = new URL(process.env.NPD_TEST_DATABASE_URL ?? "");
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.pathname).toBe("/stariva_npd_test");
    process.env.POSTGRES_URL = url.href;
    spyOn(console, "error").mockImplementation(() => {});
    spyOn(console, "info").mockImplementation(() => {});

    class NpdError extends Error {
      constructor(
        readonly outcome: "not_created" | "unknown",
        message: string,
      ) {
        super(message);
      }
    }
    let autoEmail = false;
    const createIncome = mock(async (): Promise<string> => "203e2ralw5");
    mock.module("./client", () => ({
      createIncome,
      isNpdConfigured: () => true,
      isNpdAutoEmail: () => autoEmail,
      NpdError,
      receiptPrintUrl: (n: string) =>
        `https://lknpd.nalog.ru/api/v1/receipt/502480197143/${n}/print`,
    }));
    const notifyStaffAlert = mock(async () => {});
    mock.module("@/lib/commerce/order-notifications", () => ({
      notifyStaffAlert,
    }));
    const emails = await import("@stariva/emails");
    const sendReceiptEmail = mock(async () => {});
    mock.module("@stariva/emails", () => ({ ...emails, sendReceiptEmail }));
    const storage = await import("@stariva/storage");
    mock.module("@stariva/storage", () => ({
      ...storage,
      isPublicStorageConfigured: () => false,
    }));

    const { db } = await import("@stariva/db");
    const { npdIncomeRequests, orderReceipts, orders, user, workshops } =
      await import("@stariva/db/schema");
    const { eq } = await import("drizzle-orm");
    const { issueNpdReceipt } = await import("./issue");

    const prefix = crypto.randomUUID();
    await db
      .insert(user)
      .values({ id: prefix, name: "Test", email: `${prefix}@example.test` });
    await db.insert(workshops).values({
      slug: prefix,
      title: "Test",
      category: "interior",
      status: "published",
      price: 10000,
    });
    const addOrder = async () => {
      const id = crypto.randomUUID();
      await db.insert(orders).values({
        id,
        userId: prefix,
        workshopSlug: prefix,
        amount: 10000,
        status: "paid",
        contactEmail: `${prefix}@example.test`,
      });
      return id;
    };
    const payment = (id: string): YooKassaPayment => ({
      id: `${prefix}-${id}`,
      status: "succeeded",
      paid: true,
      amount: { value: "100.00", currency: "RUB" },
      captured_at: "2026-10-19T09:30:00.000Z",
    });
    const issue = (orderId: string, p: YooKassaPayment, amount = 10000) =>
      issueNpdReceipt({
        payment: p,
        target: { kind: "workshop", orderId },
        services: [{ name: "Мастер-класс «Test»", amount, quantity: 1 }],
        email: {
          to: `${prefix}@example.test`,
          subject: "мастер-классу «Test»",
        },
        expected: 1,
      });
    const requestOf = async (p: YooKassaPayment) =>
      (
        await db
          .select()
          .from(npdIncomeRequests)
          .where(eq(npdIncomeRequests.paymentId, p.id))
      )[0];
    const receiptsOf = (orderId: string) =>
      db
        .select()
        .from(orderReceipts)
        .where(eq(orderReceipts.workshopOrderId, orderId));

    // Успех: чек сохранён и ждёт мастера — письма нет, есть алерт «проверьте».
    // Повтор вебхука ничего не делает
    const paid = await addOrder();
    const ok = payment("ok");
    await issue(paid, ok);
    await issue(paid, ok);
    expect(createIncome).toHaveBeenCalledTimes(1);
    const [receipt] = await receiptsOf(paid);
    expect(receipt).toMatchObject({ number: "203e2ralw5", emailedAt: null });
    expect(sendReceiptEmail).not.toHaveBeenCalled();
    expect(notifyStaffAlert).toHaveBeenCalledTimes(1);
    expect(await requestOf(ok)).toMatchObject({
      status: "issued",
      receiptId: receipt?.id,
    });

    // С автоотправкой чек сразу уходит покупателю, без алерта
    autoEmail = true;
    createIncome.mockImplementationOnce(async () => "auto1");
    notifyStaffAlert.mockClear();
    const sent = await addOrder();
    await issue(sent, payment("auto"));
    const [sentReceipt] = await receiptsOf(sent);
    expect(sentReceipt?.emailedAt).not.toBeNull();
    expect(sendReceiptEmail).toHaveBeenCalledTimes(1);
    expect(notifyStaffAlert).not.toHaveBeenCalled();
    autoEmail = false;

    // ФНС не ответила: чек мог появиться — алерт мастеру и без повторов
    createIncome.mockClear();
    createIncome.mockImplementationOnce(async () => {
      throw new NpdError("unknown", "timeout");
    });
    const lost = await addOrder();
    const lostPayment = payment("lost");
    await issue(lost, lostPayment);
    await issue(lost, lostPayment);
    expect(createIncome).toHaveBeenCalledTimes(1);
    expect((await requestOf(lostPayment))?.status).toBe("unknown");
    expect(notifyStaffAlert).toHaveBeenCalledTimes(1);
    expect(await receiptsOf(lost)).toHaveLength(0);

    // Строки не сходятся с оплатой — чек не выписываем
    createIncome.mockClear();
    const mismatch = payment("mismatch");
    await issue(await addOrder(), mismatch, 9000);
    expect(createIncome).not.toHaveBeenCalled();
    expect((await requestOf(mismatch))?.status).toBe("failed");

    // Мастер уже привязала чек вручную — второй не нужен
    const manual = await addOrder();
    await db.insert(orderReceipts).values({
      workshopOrderId: manual,
      inn: "502480197143",
      number: `${prefix.slice(0, 8)}manual`,
      url: "https://lknpd.nalog.ru/api/v1/receipt/502480197143/manual/print",
    });
    await issue(manual, payment("manual"));
    expect(createIncome).not.toHaveBeenCalled();
  },
);
