import { randomUUID } from "node:crypto";
import {
  and,
  courseAccess,
  db,
  eq,
  inArray,
  isNull,
  like,
  orders,
  sql,
  workshops,
} from "@stariva/db";
import { earnsPreorderBonus } from "./preorder-bonus";

export interface BoostyActivationResult {
  /** Заказы, которые открыли доступ прямо сейчас. */
  orderIds: string[];
  /** На этот email уже есть оплаченный заказ Boosty. */
  alreadyActive: boolean;
}

/**
 * Автоматически подтверждает pending-заказы Boosty по email покупателя:
 * оплата прошла на Boosty, а вебхука оттуда нет. Доступ выдаём одной
 * транзакцией, письмо со ссылкой входа отправляет вызывающий код после
 * коммита.
 */
export async function activateBoostyOrders(
  email: string,
): Promise<BoostyActivationResult> {
  const orderIds = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(orders)
      .where(
        and(
          eq(sql`lower(${orders.contactEmail})`, email),
          eq(orders.status, "pending"),
          like(orders.paymentId, "boosty:%"),
        ),
      )
      .for("update");
    if (rows.length === 0) return [] as string[];

    const slugs = [...new Set(rows.map((row) => row.workshopSlug))];
    const releases = new Map(
      (
        await tx
          .select({ slug: workshops.slug, releaseAt: workshops.releaseAt })
          .from(workshops)
          .where(inArray(workshops.slug, slugs))
      ).map((row) => [row.slug, row.releaseAt] as const),
    );

    const activated: string[] = [];
    const now = new Date();
    for (const row of rows) {
      const [updated] = await tx
        .update(orders)
        .set({
          status: "paid",
          paidAt: now,
          // Заявка остаётся в админке: по ней видно, что заказ пришёл из Boosty
          boostyActivationRequestedAt: row.boostyActivationRequestedAt ?? now,
        })
        .where(and(eq(orders.id, row.id), eq(orders.status, "pending")))
        .returning({ id: orders.id });
      if (!updated) continue;

      await tx
        .insert(courseAccess)
        .values({
          id: randomUUID(),
          userId: row.userId,
          workshopSlug: row.workshopSlug,
          orderId: row.id,
        })
        .onConflictDoNothing({
          target: [courseAccess.userId, courseAccess.workshopSlug],
        });

      // Подарок за предзаказ — как при обычной оплате на сайте
      const bonus = earnsPreorderBonus({
        workshopSlug: row.workshopSlug,
        orderedAt: row.createdAt,
        releaseAt: releases.get(row.workshopSlug) ?? null,
      });
      if (bonus) {
        await tx
          .insert(courseAccess)
          .values({
            id: randomUUID(),
            userId: row.userId,
            workshopSlug: bonus.slug,
            orderId: row.id,
          })
          .onConflictDoNothing({
            target: [courseAccess.userId, courseAccess.workshopSlug],
          });
      }
      activated.push(row.id);
    }
    return activated;
  });

  if (orderIds.length > 0) return { orderIds, alreadyActive: false };

  const [paid] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(sql`lower(${orders.contactEmail})`, email),
        eq(orders.status, "paid"),
        like(orders.paymentId, "boosty:%"),
      ),
    )
    .limit(1);
  return { orderIds, alreadyActive: Boolean(paid) };
}

/**
 * Резервный путь: автоактивация не удалась, поэтому помечаем pending-заказы
 * для ручной сверки в админке — как до появления автоматики.
 */
export async function requestBoostyActivation(email: string): Promise<void> {
  await db
    .update(orders)
    .set({ boostyActivationRequestedAt: new Date() })
    .where(
      and(
        eq(sql`lower(${orders.contactEmail})`, email),
        eq(orders.status, "pending"),
        like(orders.paymentId, "boosty:%"),
        isNull(orders.boostyActivationRequestedAt),
      ),
    );
}
