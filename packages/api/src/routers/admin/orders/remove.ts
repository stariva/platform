import { ORPCError } from "@orpc/server";
import {
  and,
  eq,
  inArray,
  productOrderPayments,
  productOrders,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

/** Статусы, в которых денег за заказ нет и ссылка на оплату не открыта. */
export const DELETABLE_STATUSES = [
  "requested",
  "declined",
  "canceled",
] as const;

/**
 * Удаляет заказ вместе с позициями и платежами — для спама, дублей и
 * тестовых заказов. Без `force` — только если по нему не платили и платить
 * уже не могут. С `force` мастер удаляет и такой заказ, понимая, что
 * пропадёт история платежей, а оплата по старой ссылке уйдёт в никуда —
 * webhook не найдёт заказ. Деньги и заказ в Ozon Доставка это не трогает.
 */
export const remove = adminProcedure
  .input(z.object({ id: z.string().min(1), force: z.boolean().default(false) }))
  .handler(async ({ context, input }) =>
    context.db.transaction(async (tx) => {
      const [order] = await tx
        .select({
          status: productOrders.status,
          paidAt: productOrders.paidAt,
          depositPaidAt: productOrders.depositPaidAt,
        })
        .from(productOrders)
        .where(eq(productOrders.id, input.id))
        .for("update");
      if (!order)
        throw new ORPCError("NOT_FOUND", { message: "Заказ не найден" });

      const [payment] = await tx
        .select({ id: productOrderPayments.id })
        .from(productOrderPayments)
        .where(
          and(
            eq(productOrderPayments.orderId, input.id),
            inArray(productOrderPayments.status, ["pending", "succeeded"]),
          ),
        )
        .limit(1);

      const deletable =
        (DELETABLE_STATUSES as readonly string[]).includes(order.status) &&
        !order.paidAt &&
        !order.depositPaidAt &&
        !payment;
      if (!deletable && !input.force) {
        throw new ORPCError("CONFLICT", {
          message:
            "По заказу были оплаты или открыта ссылка на оплату — подтвердите удаление",
        });
      }

      await tx.delete(productOrders).where(eq(productOrders.id, input.id));
      return { ok: true as const };
    }),
  );
