import { ORPCError } from "@orpc/server";
import { and, eq, productOrderStatus, productOrders } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { isManualStatus } from "./shape";

/**
 * Мастер ведёт заказ: статус, номер отправления и внутренняя заметка.
 * Статус можно поставить любой из статусов этого вида заказа, кроме тех, где
 * покупатель платит: суммы и срок оплаты задают оформление и кнопки этапов
 * (stages.ts). Ручная смена не трогает деньги — ни оплаты, ни возвраты.
 */
export const update = adminProcedure
  .input(
    z.object({
      id: z.string().min(1),
      status: z.enum(productOrderStatus.enumValues).optional(),
      // Статус, который видел мастер: если заказ успел сменить его сам
      // (оплата, Ozon), ручная смена не должна это затереть
      fromStatus: z.enum(productOrderStatus.enumValues).optional(),
      masterNotes: z.string().trim().max(2000).optional(),
      trackingNumber: z.string().trim().max(200).optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    const { id, status, fromStatus, masterNotes, trackingNumber } = input;
    const [order] = await context.db
      .select({ kind: productOrders.kind, status: productOrders.status })
      .from(productOrders)
      .where(eq(productOrders.id, id));
    if (!order)
      throw new ORPCError("NOT_FOUND", { message: "Заказ не найден" });

    const conflict = () =>
      new ORPCError("CONFLICT", {
        message: "Заказ изменился, обновите страницу",
      });
    if (status !== undefined && fromStatus && fromStatus !== order.status) {
      throw conflict();
    }
    const statusChanged = status !== undefined && status !== order.status;
    if (statusChanged && !isManualStatus(order.kind, status)) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Этот статус ставится только кнопками этапа — в нём покупателю нужна сумма к оплате",
      });
    }

    const [updated] = await context.db
      .update(productOrders)
      .set({
        // Вручную оплату не ждём: срок оплаты больше не действует
        ...(statusChanged && { status, paymentDueAt: null }),
        ...(masterNotes !== undefined && { masterNotes: masterNotes || null }),
        ...(trackingNumber !== undefined && {
          trackingNumber: trackingNumber || null,
        }),
      })
      .where(
        and(
          eq(productOrders.id, id),
          statusChanged ? eq(productOrders.status, order.status) : undefined,
        ),
      )
      .returning({
        id: productOrders.id,
        status: productOrders.status,
        masterNotes: productOrders.masterNotes,
        trackingNumber: productOrders.trackingNumber,
      });
    if (!updated) throw conflict();
    return updated;
  });
