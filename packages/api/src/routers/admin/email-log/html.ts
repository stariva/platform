import { ORPCError } from "@orpc/server";
import { emailLog, eq } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

/**
 * HTML отправленного письма — по одному, когда его открыли в админке: в списке
 * страницы он весил бы мегабайты.
 *
 * Бросает NOT_FOUND, если письма нет или его тело не сохранено (письма с
 * кодами входа и ссылками, записи до появления колонки).
 */
export const html = adminProcedure
  .input(z.object({ id: z.string().min(1).max(64) }))
  .handler(async ({ context, input }) => {
    const [row] = await context.db
      .select({ html: emailLog.html })
      .from(emailLog)
      .where(eq(emailLog.id, input.id))
      .limit(1);
    if (!row?.html) throw new ORPCError("NOT_FOUND");
    return { html: row.html };
  });
