import { ORPCError } from "@orpc/server";
import { eq, user } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

/**
 * Правит профиль пользователя: имя и отметку «почта подтверждена».
 * Адрес почты не трогаем — по нему человек входит в аккаунт.
 */
export const update = adminProcedure
  .input(
    z.object({
      id: z.string().min(1),
      name: z.string().trim().min(1).max(100).optional(),
      emailVerified: z.boolean().optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    const { id, ...fields } = input;
    if (Object.keys(fields).length === 0) {
      throw new ORPCError("BAD_REQUEST", { message: "Нечего менять" });
    }

    const [updated] = await context.db
      .update(user)
      .set(fields)
      .where(eq(user.id, id))
      .returning({
        id: user.id,
        name: user.name,
        emailVerified: user.emailVerified,
      });
    if (!updated) {
      throw new ORPCError("NOT_FOUND", { message: "Пользователь не найден" });
    }

    return updated;
  });
