import { ORPCError } from "@orpc/server";
import { cartEvents, eq } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

/**
 * Удаляет корзину целиком: все её события. Нужно для тестов, мусора и чужих
 * заходов. Сами заказы не трогаются. Корзина живёт в браузере посетителя — ему
 * удаление не видно; если он снова что-то положит, корзина появится в списке
 * заново, но уже с чистой историей.
 *
 * Возвращает, сколько событий удалено. Бросает NOT_FOUND, если событий с таким
 * cart_id нет.
 *
 * @example client.admin.carts.remove({ id: "cart_123" })
 */
export const remove = adminProcedure
  .input(z.object({ id: z.string().min(1).max(64) }))
  .handler(async ({ context, input }) => {
    const removed = await context.db
      .delete(cartEvents)
      .where(eq(cartEvents.cartId, input.id))
      .returning({ id: cartEvents.id });
    if (removed.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Корзина не найдена" });
    }
    return { cartId: input.id, removed: removed.length };
  });
