import { ORPCError } from "@orpc/server";
import { customOrderRequests, eq } from "@stariva/db";
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
    try {
      // Внешний ключ запрещает удаление и при конкурентной записи заказа.
      const [removed] = await context.db
        .delete(customOrderRequests)
        .where(eq(customOrderRequests.number, input.number))
        .returning({ number: customOrderRequests.number });
      if (removed) return removed;
    } catch (error) {
      const cause = (error as { cause?: unknown })?.cause;
      const pg = (cause ?? error) as {
        code?: string;
        constraint?: string;
      } | null;
      if (
        (pg?.code === "23503" || pg?.code === "23001") &&
        pg.constraint ===
          "crm_sales_request_number_custom_order_requests_number_fk"
      ) {
        throw new ORPCError("CONFLICT", {
          message: "По заявке записан заказ — сначала удалите заказ",
        });
      }
      throw error;
    }
    throw new ORPCError("NOT_FOUND", { message: "Заявка не найдена" });
  });
