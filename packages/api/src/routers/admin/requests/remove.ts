import { ORPCError } from "@orpc/server";
import { and, crmSales, customOrderRequests, eq, notExists } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

/**
 * Удаляет заявку насовсем вместе с фото: спам, тесты, дубли. Заявку, по которой
 * записан заказ, удалить нельзя — заказ потеряет источник; такую сначала
 * отвязывают, удалив заказ.
 *
 * @example client.admin.requests.remove({ number: 1042 })
 */
export const remove = adminProcedure
  .input(z.object({ number: z.number().int().positive() }))
  .handler(async ({ context, input }) => {
    // Проверка заказа и удаление — одним запросом, чтобы заказ, записанный
    // между ними, не остался со ссылкой на несуществующую заявку.
    const [removed] = await context.db
      .delete(customOrderRequests)
      .where(
        and(
          eq(customOrderRequests.number, input.number),
          notExists(
            context.db
              .select({ id: crmSales.id })
              .from(crmSales)
              .where(eq(crmSales.requestNumber, input.number)),
          ),
        ),
      )
      .returning({ number: customOrderRequests.number });
    if (removed) return removed;

    const [exists] = await context.db
      .select({ number: customOrderRequests.number })
      .from(customOrderRequests)
      .where(eq(customOrderRequests.number, input.number));
    if (!exists) {
      throw new ORPCError("NOT_FOUND", { message: "Заявка не найдена" });
    }
    throw new ORPCError("CONFLICT", {
      message: "По заявке записан заказ — сначала удалите заказ",
    });
  });
