import { randomUUID } from "node:crypto";
import { db } from "@stariva/db";
import { orders } from "@stariva/db/schema";
import { and, desc, eq } from "drizzle-orm";

export interface CreateOrderInput {
  userId: string;
  workshopSlug: string;
  amountKopecks: number;
}

/** Создаёт заказ в статусе pending и возвращает его id. */
export async function createOrder(input: CreateOrderInput): Promise<string> {
  const id = randomUUID();
  await db.insert(orders).values({
    id,
    userId: input.userId,
    workshopSlug: input.workshopSlug,
    amount: input.amountKopecks,
    currency: "RUB",
    status: "pending",
  });
  return id;
}

/** Привязывает идентификатор платежа YooKassa к заказу. */
export async function attachPaymentId(
  orderId: string,
  paymentId: string,
): Promise<void> {
  await db.update(orders).set({ paymentId }).where(eq(orders.id, orderId));
}

export async function getOrderById(orderId: string) {
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return rows[0] ?? null;
}

/** Помечает заказ оплаченным. Идемпотентно: повторный вызов не меняет paidAt. */
export async function markOrderPaid(orderId: string): Promise<boolean> {
  const result = await db
    .update(orders)
    .set({ status: "paid", paidAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
    .returning({ id: orders.id });
  return result.length > 0;
}

export async function markOrderCanceled(orderId: string): Promise<void> {
  await db
    .update(orders)
    .set({ status: "canceled" })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
}

/** История заказов пользователя (новые сверху). */
export async function listUserOrders(userId: string) {
  return db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
}
