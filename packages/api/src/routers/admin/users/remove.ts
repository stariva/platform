import { ORPCError } from "@orpc/server";
import { and, eq, inArray, orders, user } from "@stariva/db";
import { z } from "zod";

import { adminProcedure, isAdminEmail } from "../../../orpc";

/**
 * Удаляет аккаунт вместе с сессиями, доступами, прогрессом и сертификатами.
 * Заказы на товары остаются без привязки к аккаунту (в них есть контакты).
 *
 * Нельзя удалить администратора и пользователя с оплаченными заказами на
 * мастер-классы: вместе с аккаунтом пропала бы история платежей.
 */
export const remove = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [found] = await context.db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.id, input.id));
    if (!found) {
      throw new ORPCError("NOT_FOUND", { message: "Пользователь не найден" });
    }

    if (isAdminEmail(found.email)) {
      throw new ORPCError("CONFLICT", {
        message:
          "Администратора удалить нельзя — сначала уберите его из ADMIN_EMAILS",
      });
    }

    const [paid] = await context.db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.userId, input.id),
          inArray(orders.status, ["paid", "refunded"]),
        ),
      )
      .limit(1);
    if (paid) {
      throw new ORPCError("CONFLICT", {
        message:
          "У пользователя есть оплаченные заказы на мастер-классы — удалить аккаунт нельзя, иначе пропадёт история платежей",
      });
    }

    await context.db.delete(user).where(eq(user.id, input.id));
    return { ok: true as const };
  });
