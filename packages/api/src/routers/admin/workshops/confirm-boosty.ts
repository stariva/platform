import { randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, courseAccess, eq, orders } from "@stariva/db";
import { z } from "zod";
import { adminProcedure } from "../../../orpc";
import { notifyBoostyOrder } from "../../../storefront";

/** Администратор вручную сверил покупку платного поста в Boosty. */
export const confirmBoosty = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, input }) => {
    const order = await context.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, input.id))
        .for("update");
      if (
        !row ||
        !row.paymentId?.startsWith("boosty:") ||
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
      return row;
    });
    return { ok: true as const, notified: await notifyBoostyOrder(order.id) };
  });
