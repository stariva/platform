import { ORPCError } from "@orpc/server";
import { eq, orders } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

/**
 * Удаляет запись на мастер-класс вместе с чеками и журналом уведомлений — для
 * спама, дублей и тестовых заказов. Без `force` — только отменённый заказ без
 * оплаты. Ожидающий оплаты заказ ещё может оплатиться по открытой ссылке, а
 * оплаченный и возвращённый несут историю денег: с `force` мастер удаляет и их,
 * понимая, что оплата по старой ссылке уйдёт в никуда. Доступ к курсу это не
 * закрывает — его отзывают на странице пользователя, а деньги не возвращает.
 *
 * @example client.admin.workshops.removeOrder({ id: "ord_1", force: true })
 */
export const removeOrder = adminProcedure
  .input(z.object({ id: z.string().min(1), force: z.boolean().default(false) }))
  .handler(async ({ context, input }) =>
    context.db.transaction(async (tx) => {
      const [order] = await tx
        .select({ status: orders.status, paidAt: orders.paidAt })
        .from(orders)
        .where(eq(orders.id, input.id))
        .for("update");
      if (!order)
        throw new ORPCError("NOT_FOUND", { message: "Запись не найдена" });

      const deletable = order.status === "canceled" && !order.paidAt;
      if (!deletable && !input.force) {
        throw new ORPCError("CONFLICT", {
          message:
            "По записи были оплаты или открыта ссылка на оплату — подтвердите удаление",
        });
      }

      await tx.delete(orders).where(eq(orders.id, input.id));
      return { ok: true as const };
    }),
  );
