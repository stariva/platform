import { ORPCError } from "@orpc/server";
import { courseAccess, eq } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

/**
 * Закрывает пользователю мастер-класс. Прогресс просмотра и сертификат
 * остаются — при повторной выдаче доступа человек продолжит с того же места.
 */
export const revokeAccess = adminProcedure
  .input(z.object({ accessId: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [removed] = await context.db
      .delete(courseAccess)
      .where(eq(courseAccess.id, input.accessId))
      .returning({ id: courseAccess.id });
    if (!removed) {
      throw new ORPCError("NOT_FOUND", { message: "Доступ не найден" });
    }

    return { ok: true as const };
  });
