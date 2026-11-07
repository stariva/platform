import { expect, test } from "bun:test";

// Раннер (scripts/test-integration.ts) даёт каждому набору свою базу, потому
// что @stariva/db читает POSTGRES_URL один раз на процесс. Поэтому база и все
// модули, которые к ней обращаются, подключаются только внутри теста.
const DATABASE_URL = process.env.ORDER_SHIPMENT_TEST_DATABASE_URL;

async function connect() {
  const url = new URL(DATABASE_URL ?? "");
  expect(url.hostname).toBe("127.0.0.1");
  expect(url.pathname).toBe("/stariva_order_shipment_test");
  process.env.POSTGRES_URL = url.href;
  const { db } = await import("@stariva/db");
  const { productOrderPayments, productOrders } = await import(
    "@stariva/db/schema"
  );
  const { eq, sql } = await import("drizzle-orm");
  const orders = await import("./orders");

  const notifiedAt = new Date("2026-11-07T10:00:00Z");

  /** Оплаченный заказ под заказ, у которого идёт попытка создать отправление. */
  async function seed(attemptId: string) {
    const id = crypto.randomUUID();
    const depositId = `${id}-deposit`;
    const balanceId = `${id}-balance`;
    await db.insert(productOrders).values({
      id,
      kind: "made_to_order",
      contactName: "Анна",
      contactPhone: "+79001234567",
      status: "ready_to_ship",
      amountProducts: 390_000,
      amountDelivery: 45_000,
      amountTotal: 435_000,
      depositAmount: 195_000,
      deliveryMethod: "pickup",
      deliveryPointId: "1234",
      checkoutSnapshot: {
        parcel: { weightGrams: 800, lengthCm: 60, widthCm: 30, heightCm: 20 },
        priceKopecks: 45_000,
      },
      ozonShipmentStatus: "creating",
      ozonShipmentAttemptId: attemptId,
      ozonShipmentAttemptedAt: new Date(),
    });
    // Мастеру об обеих оплатах уже сообщали
    await db.insert(productOrderPayments).values([
      {
        id: depositId,
        orderId: id,
        type: "deposit",
        amount: 195_000,
        status: "succeeded",
        staffNotifiedAt: notifiedAt,
      },
      {
        id: balanceId,
        orderId: id,
        type: "balance",
        amount: 240_000,
        status: "succeeded",
        staffNotifiedAt: notifiedAt,
      },
    ]);
    return { id, depositId, balanceId };
  }

  async function orderOf(id: string) {
    const [order] = await db
      .select()
      .from(productOrders)
      .where(eq(productOrders.id, id));
    if (!order) throw new Error(`order ${id} not found`);
    return order;
  }

  async function noticeOf(paymentId: string) {
    const [payment] = await db
      .select({ staffNotifiedAt: productOrderPayments.staffNotifiedAt })
      .from(productOrderPayments)
      .where(eq(productOrderPayments.id, paymentId));
    if (!payment) throw new Error(`payment ${paymentId} not found`);
    return payment.staffNotifiedAt;
  }

  return {
    db,
    sql,
    notifiedAt,
    orders,
    seed,
    orderOf,
    noticeOf,
    productOrders,
  };
}

test.skipIf(!DATABASE_URL)(
  "an unapproved parcel keeps its numbers and re-opens the balance notice together",
  async () => {
    const { orders, seed, orderOf, noticeOf, notifiedAt } = await connect();
    const { id, balanceId, depositId } = await seed("attempt-1");

    await orders.markMadeToOrderShipmentUnapproved(
      id,
      "attempt-1",
      "YY-123-90YY",
      ["123-90YY-1", "123-90YY-2"],
      balanceId,
    );

    const order = await orderOf(id);
    expect(order.status).toBe("ozon_order_failed");
    expect(order.ozonOrderId).toBe("YY-123-90YY");
    expect(order.ozonPostingNumbers).toEqual(["123-90YY-1", "123-90YY-2"]);
    expect(order.ozonShipmentStatus).toBe("failed");
    // Номер отправления покупателю не показываем: посылка ещё не едет
    expect(order.trackingNumber).toBeNull();

    // Уведомление о доплате снова неотправленное, о предоплате — не трогали
    expect(await noticeOf(balanceId)).toBeNull();
    expect(await noticeOf(depositId)).toEqual(notifiedAt);

    // Повтор webhook не создаст в Ozon второй заказ
    expect(await orders.claimMadeToOrderShipment(id)).toBeNull();

    // А уведомление уйдёт ровно один раз
    expect(await orders.claimPaymentNotification(balanceId)).toBe(true);
    expect(await orders.claimPaymentNotification(balanceId)).toBe(false);
  },
);

test.skipIf(!DATABASE_URL)(
  "a save from another attempt changes neither the order nor the notice",
  async () => {
    const { orders, seed, orderOf, noticeOf, notifiedAt } = await connect();
    const { id, balanceId } = await seed("attempt-new");

    await orders.markMadeToOrderShipmentUnapproved(
      id,
      "attempt-old",
      "YY-123-90YY",
      ["123-90YY-1"],
      balanceId,
    );

    const order = await orderOf(id);
    expect(order.status).toBe("ready_to_ship");
    expect(order.ozonOrderId).toBeNull();
    expect(order.ozonShipmentStatus).toBe("creating");
    expect(order.ozonShipmentAttemptId).toBe("attempt-new");
    expect(await noticeOf(balanceId)).toEqual(notifiedAt);
  },
);

test.skipIf(!DATABASE_URL)(
  "a failure while re-opening the notice rolls the saved numbers back",
  async () => {
    const { db, sql, orders, seed, orderOf, noticeOf, notifiedAt } =
      await connect();
    const { id, balanceId } = await seed("attempt-1");

    // Сбой именно во втором запросе транзакции: триггер роняет обновление
    // оплаты, а заказ к этому моменту уже обновлён
    await db.execute(
      sql`create function fail_notice_reset() returns trigger language plpgsql as $$ begin raise exception 'simulated failure'; end $$`,
    );
    await db.execute(
      sql.raw(
        `create trigger fail_notice_reset before update on product_order_payments for each row when (old.id = '${balanceId}') execute function fail_notice_reset()`,
      ),
    );
    try {
      await expect(
        orders.markMadeToOrderShipmentUnapproved(
          id,
          "attempt-1",
          "YY-123-90YY",
          ["123-90YY-1"],
          balanceId,
        ),
      ).rejects.toThrow();
    } finally {
      await db.execute(
        sql`drop trigger fail_notice_reset on product_order_payments`,
      );
      await db.execute(sql`drop function fail_notice_reset()`);
    }

    // Номера не сохранились без сброса отметки: заказ как был
    const untouched = await orderOf(id);
    expect(untouched.status).toBe("ready_to_ship");
    expect(untouched.ozonOrderId).toBeNull();
    expect(untouched.ozonPostingNumbers).toBeNull();
    expect(untouched.ozonShipmentStatus).toBe("creating");
    expect(await noticeOf(balanceId)).toEqual(notifiedAt);

    // Без сбоя то же сохранение проходит целиком
    await orders.markMadeToOrderShipmentUnapproved(
      id,
      "attempt-1",
      "YY-123-90YY",
      ["123-90YY-1"],
      balanceId,
    );
    expect((await orderOf(id)).ozonOrderId).toBe("YY-123-90YY");
    expect(await noticeOf(balanceId)).toBeNull();
  },
);

/** Заказ, у которого изделие готово: мастер выставила доплату, посылка есть. */
async function seedBalance(
  connection: Awaited<ReturnType<typeof connect>>,
  overrides: {
    status?: "awaiting_balance" | "ready_to_ship";
    snapshot?: unknown;
  },
) {
  const id = crypto.randomUUID();
  await connection.db.insert(connection.productOrders).values({
    id,
    kind: "made_to_order",
    contactName: "Анна",
    contactPhone: "+79001234567",
    status: overrides.status ?? "awaiting_balance",
    amountProducts: 390_000,
    amountDelivery: 0,
    amountTotal: 390_000,
    depositAmount: 195_000,
    deliveryMethod: "manual",
    checkoutSnapshot:
      "snapshot" in overrides
        ? overrides.snapshot
        : {
            parcel: {
              weightGrams: 800,
              lengthCm: 60,
              widthCm: 30,
              heightCm: 20,
            },
            priceKopecks: null,
          },
  });
  return id;
}

test.skipIf(!DATABASE_URL)(
  "the delivery price lands in the order with the point and the parcel stays",
  async () => {
    const connection = await connect();
    const { orders, orderOf } = connection;
    const parcel = {
      weightGrams: 800,
      lengthCm: 60,
      widthCm: 30,
      heightCm: 20,
    };
    const id = await seedBalance(connection, {});

    expect(
      await orders.saveMadeToOrderDeliveryPrice(id, "77", null, 45_000),
    ).toBe(true);
    const priced = await orderOf(id);
    expect(priced.deliveryMethod).toBe("pickup");
    expect(priced.deliveryPointId).toBe("77");
    expect(priced.amountDelivery).toBe(45_000);
    expect(priced.amountTotal).toBe(435_000);
    expect(priced.checkoutSnapshot).toEqual({ parcel, priceKopecks: 45_000 });

    // Другой пункт: итог считается от изделий, а не наращивается поверх прежнего
    expect(
      await orders.saveMadeToOrderDeliveryPrice(id, "88", null, 50_000),
    ).toBe(true);
    const changed = await orderOf(id);
    expect(changed.deliveryPointId).toBe("88");
    expect(changed.amountTotal).toBe(440_000);
    expect(changed.checkoutSnapshot).toEqual({ parcel, priceKopecks: 50_000 });
  },
);

test.skipIf(!DATABASE_URL)(
  "the delivery price is not written once the order no longer waits for the balance",
  async () => {
    const connection = await connect();
    const { orders, orderOf } = connection;

    // Доплата уже оплачена
    const paid = await seedBalance(connection, { status: "ready_to_ship" });
    expect(
      await orders.saveMadeToOrderDeliveryPrice(paid, "77", null, 45_000),
    ).toBe(false);
    const untouched = await orderOf(paid);
    expect(untouched.amountDelivery).toBe(0);
    expect(untouched.deliveryPointId).toBeNull();

    // Доплата с ручной доставкой: посылки нет, пункт у неё не спрашивают
    const manual = await seedBalance(connection, { snapshot: null });
    expect(
      await orders.saveMadeToOrderDeliveryPrice(manual, "77", null, 45_000),
    ).toBe(false);
    expect((await orderOf(manual)).amountTotal).toBe(390_000);
  },
);
