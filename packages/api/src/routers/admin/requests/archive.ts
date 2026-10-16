import { ORPCError } from "@orpc/server";
import { customOrderRequests, eq } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

/**
 * Убирает заявку из «Новых» в ленте заказов, когда заказа по ней не будет:
 * клиент не ответил, не договорились. Вернуть можно тем же вызовом.
 *
 * @example client.admin.requests.archive({ number: 1042, archived: true })
 */
export const archive = adminProcedure
  .input(
    z.object({ number: z.number().int().positive(), archived: z.boolean() }),
  )
  .handler(async ({ context, input }) => {
    const [updated] = await context.db
      .update(customOrderRequests)
      .set({ archivedAt: input.archived ? new Date() : null })
      .where(eq(customOrderRequests.number, input.number))
      .returning({
        number: customOrderRequests.number,
        archivedAt: customOrderRequests.archivedAt,
      });
    if (!updated) {
      throw new ORPCError("NOT_FOUND", { message: "Заявка не найдена" });
    }
    return updated;
  });
