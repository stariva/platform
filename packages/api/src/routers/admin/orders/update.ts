import { ORPCError } from "@orpc/server";
import { and, eq, inArray, productOrders } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { MANUAL_STATUSES } from "./shape";

/**
 * Мастер ведёт заказ под заказ: номер отправления, внутренняя заметка и —
 * после полной оплаты — статус отправки. Остальные статусы двигают кнопки
 * этапов (stages.ts), платёжная система и Ozon Доставка.
 */
export const update = adminProcedure
  .input(
    z.object({
      id: z.string().min(1),
      status: z.enum(MANUAL_STATUSES).optional(),
      masterNotes: z.string().trim().max(2000).optional(),
      trackingNumber: z.string().trim().max(200).optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    const { id, status, masterNotes, trackingNumber } = input;
    const [order] = await context.db
      .select({ kind: productOrders.kind, status: productOrders.status })
      .from(productOrders)
      .where(eq(productOrders.id, id));
    if (!order)
      throw new ORPCError("NOT_FOUND", { message: "Заказ не найден" });

    if (status !== undefined) {
      if (
        order.kind !== "made_to_order" ||
        !(MANUAL_STATUSES as readonly string[]).includes(order.status)
      ) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Статус отправки можно менять только у оплаченного заказа",
        });
      }
    }

    const [updated] = await context.db
      .update(productOrders)
      .set({
        ...(status !== undefined && { status }),
        ...(masterNotes !== undefined && { masterNotes: masterNotes || null }),
        ...(trackingNumber !== undefined && {
          trackingNumber: trackingNumber || null,
        }),
      })
      .where(
        and(
          eq(productOrders.id, id),
          // Статус мог уйти из рабочего набора, пока мастер смотрел заказ
          status !== undefined
            ? inArray(productOrders.status, [...MANUAL_STATUSES])
            : undefined,
        ),
      )
      .returning({
        id: productOrders.id,
        status: productOrders.status,
        masterNotes: productOrders.masterNotes,
        trackingNumber: productOrders.trackingNumber,
      });
    if (!updated) {
      throw new ORPCError("CONFLICT", {
        message: "Заказ изменился, обновите страницу",
      });
    }
    return updated;
  });
