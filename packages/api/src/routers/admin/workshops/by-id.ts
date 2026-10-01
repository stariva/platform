import { ORPCError } from "@orpc/server";
import { eq, workshops } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { rowToForm } from "./mapping";

/** Мастер-класс для формы редактирования. */
export const byId = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [row] = await context.db
      .select()
      .from(workshops)
      .where(eq(workshops.id, input.id));
    if (!row) {
      throw new ORPCError("NOT_FOUND", { message: "Мастер-класс не найден" });
    }
    return { id: row.id, values: rowToForm(row), updatedAt: row.updatedAt };
  });
