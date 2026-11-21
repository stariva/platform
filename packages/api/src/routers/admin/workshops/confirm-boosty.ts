import { randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import {
  and,
  courseAccess,
  type Database,
  eq,
  orders,
  workshops,
} from "@stariva/db";
import { earnsPreorderBonus } from "@stariva/web-api/preorder-bonus";
import { z } from "zod";
import { adminProcedure } from "../../../orpc";
import { issueBoostyReceipt, notifyBoostyOrder } from "../../../storefront";

export async function confirmBoostyAccess(db: Database, id: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .for("update");
    if (
      !row?.paymentId?.startsWith("boosty:") ||
      !row.boostyActivationRequestedAt
    ) {
      throw new ORPCError("NOT_FOUND", {
        message: "Заявка Boosty не найдена",
      });
    }
    if (row.status !== "pending" && row.status !== "paid") {
      throw new ORPCError("CONFLICT", { message: "Заказ уже закрыт" });
    }
    if (row.status === "pending") {
      await tx
        .update(orders)
        .set({ status: "paid", paidAt: new Date() })
        .where(and(eq(orders.id, row.id), eq(orders.status, "pending")));
    }
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
    const [workshop] = await tx
      .select({ releaseAt: workshops.releaseAt })
      .from(workshops)
      .where(eq(workshops.slug, row.workshopSlug))
      .limit(1);
    const bonus = earnsPreorderBonus({
      workshopSlug: row.workshopSlug,
      orderedAt: row.createdAt,
      releaseAt: workshop?.releaseAt,
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
    return row;
  });
}

/** Администратор вручную сверил покупку платного поста в Boosty. */
export const confirmBoosty = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, input }) => {
    const order = await confirmBoostyAccess(context.db, input.id);
    const notified = await notifyBoostyOrder(order.id);
    return {
      ok: true as const,
      notified,
      // Чек выписывается после письма: сбой связи не мешает доступу
      receiptIssued: await issueBoostyReceipt(order.id),
    };
  });
