import { randomBytes, randomUUID } from "node:crypto";
import { db } from "@stariva/db";
import { orders, workshopOrderNotifications } from "@stariva/db/schema";
import { and, desc, eq, isNull, lte, sql } from "drizzle-orm";

export interface CreateOrderInput {
  userId: string;
  workshopSlug: string;
  amountKopecks: number;
  contactEmail: string;
}

/** 32 символа base64url: годится и для URL, и для t.me/<бот>?start=… */
function secretToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Создаёт заказ в статусе pending и возвращает его. */
export async function createOrder(input: CreateOrderInput) {
  const [order] = await db
    .insert(orders)
    .values({
      id: randomUUID(),
      userId: input.userId,
      workshopSlug: input.workshopSlug,
      amount: input.amountKopecks,
      currency: "RUB",
      status: "pending",
      contactEmail: input.contactEmail,
      accessToken: secretToken(),
      telegramToken: secretToken(),
    })
    .returning();
  if (!order) throw new Error("order_insert_failed");
  return order;
}

export type WorkshopOrder = Awaited<ReturnType<typeof createOrder>>;

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

/** Оплаченный заказ по личной ссылке входа из письма. */
export async function getPaidOrderByAccessToken(token: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.accessToken, token), eq(orders.status, "paid")))
    .limit(1);
  return order ?? null;
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

/**
 * Привязывает чат Telegram к заказу по метке из t.me/<бот>?start=<метка>.
 * Отменённые заказы не привязываем: напоминать там не о чем.
 */
export async function linkTelegramChat(telegramToken: string, chatId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.telegramToken, telegramToken))
    .limit(1);
  if (!order || order.status === "canceled" || order.status === "refunded") {
    return null;
  }
  await db
    .update(orders)
    .set({ telegramChatId: chatId })
    .where(eq(orders.id, order.id));
  return { ...order, telegramChatId: chatId };
}

/** /stop в боте: отвязывает чат от всех заказов. */
export async function unlinkTelegramChat(chatId: string): Promise<number> {
  const result = await db
    .update(orders)
    .set({ telegramChatId: null })
    .where(eq(orders.telegramChatId, chatId))
    .returning({ id: orders.id });
  return result.length;
}

export type NotificationChannel = "email" | "telegram";

/**
 * Атомарная аренда отправки на пять минут. null — уже отправлено или занято.
 * Новый id при перехвате защищает от завершения/удаления старым воркером.
 */
export async function claimOrderNotification(
  orderId: string,
  kind: string,
  channel: NotificationChannel,
): Promise<string | null> {
  const id = randomUUID();
  const leaseUntil = sql`now() + interval '5 minutes'`;
  const rows = await db
    .insert(workshopOrderNotifications)
    .values({ id, orderId, kind, channel, sentAt: null, leaseUntil })
    .onConflictDoUpdate({
      target: [
        workshopOrderNotifications.orderId,
        workshopOrderNotifications.kind,
        workshopOrderNotifications.channel,
      ],
      set: { id, leaseUntil },
      setWhere: and(
        isNull(workshopOrderNotifications.sentAt),
        lte(workshopOrderNotifications.leaseUntil, sql`now()`),
      ),
    })
    .returning({ id: workshopOrderNotifications.id });
  return rows[0]?.id ?? null;
}

/** Только владелец текущей аренды может подтвердить успешную отправку. */
export async function completeOrderNotification(
  claimId: string,
): Promise<void> {
  await db
    .update(workshopOrderNotifications)
    .set({ sentAt: sql`now()`, leaseUntil: null })
    .where(
      and(
        eq(workshopOrderNotifications.id, claimId),
        isNull(workshopOrderNotifications.sentAt),
      ),
    );
}

/** Ошибка отправки — освобождаем только свою аренду для следующей попытки. */
export async function releaseOrderNotification(claimId: string): Promise<void> {
  await db
    .delete(workshopOrderNotifications)
    .where(
      and(
        eq(workshopOrderNotifications.id, claimId),
        isNull(workshopOrderNotifications.sentAt),
      ),
    );
}
