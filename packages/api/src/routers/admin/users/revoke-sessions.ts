import { eq, session } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

/** Завершает все сессии пользователя — он выйдет со всех устройств. */
export const revokeSessions = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const removed = await context.db
      .delete(session)
      .where(eq(session.userId, input.id))
      .returning({ id: session.id });

    return { revoked: removed.length };
  });
