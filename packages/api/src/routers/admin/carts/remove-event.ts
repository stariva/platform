import { ORPCError } from "@orpc/server";
import { cartEvents, count, eq } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

/**
 * Удаляет одно событие из истории корзины: тесты, мусор, чужие клики. Состав
 * корзины «сейчас» берётся из последнего события, поэтому он пересчитается по
 * оставшимся. Сами заказы не трогаются. Корзина живёт в браузере посетителя —
 * ему удаление не видно.
 *
 * Возвращает, сколько событий осталось у корзины: если 0, корзина пропала из
 * списка и её карточка больше не открывается.
 *
 * @example client.admin.carts.removeEvent({ id: "evt_123" })
 */
export const removeEvent = adminProcedure
  .input(z.object({ id: z.string().min(1).max(64) }))
  .handler(async ({ context, input }) => {
    const [removed] = await context.db
      .delete(cartEvents)
      .where(eq(cartEvents.id, input.id))
      .returning({ id: cartEvents.id, cartId: cartEvents.cartId });
    if (!removed) {
      throw new ORPCError("NOT_FOUND", { message: "Событие не найдено" });
    }
    const [left] = await context.db
      .select({ value: count() })
      .from(cartEvents)
      .where(eq(cartEvents.cartId, removed.cartId));
    return {
      id: removed.id,
      cartId: removed.cartId,
      remaining: left?.value ?? 0,
    };
  });
