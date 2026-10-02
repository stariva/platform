import { ORPCError } from "@orpc/server";
import { courseAccess, eq, user, workshops } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

/**
 * Вручную открывает пользователю мастер-класс (без заказа). Повторная выдача
 * того же курса ничего не меняет.
 */
export const grantAccess = adminProcedure
  .input(
    z.object({
      userId: z.string().min(1),
      workshopSlug: z.string().min(1),
    }),
  )
  .handler(async ({ context, input }) => {
    const [found] = await context.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, input.userId));
    if (!found) {
      throw new ORPCError("NOT_FOUND", { message: "Пользователь не найден" });
    }

    const [workshop] = await context.db
      .select({ slug: workshops.slug })
      .from(workshops)
      .where(eq(workshops.slug, input.workshopSlug));
    if (!workshop) {
      throw new ORPCError("NOT_FOUND", { message: "Мастер-класс не найден" });
    }

    await context.db
      .insert(courseAccess)
      .values({
        id: crypto.randomUUID(),
        userId: input.userId,
        workshopSlug: input.workshopSlug,
      })
      .onConflictDoNothing({
        target: [courseAccess.userId, courseAccess.workshopSlug],
      });

    return { ok: true as const };
  });
