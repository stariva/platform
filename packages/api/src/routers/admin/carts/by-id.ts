import { ORPCError } from "@orpc/server";
import {
  cartEvents,
  desc,
  eq,
  inArray,
  productOrders,
  user,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

/** Больше событий одной корзины в карточке не показываем. */
const EVENTS_LIMIT = 500;

/**
 * Одна корзина целиком: события от новых к старым (что положил, убрал,
 * оформил, откуда), аккаунт, если посетитель входил, и заказы, которыми
 * закончились оформления.
 *
 * Бросает NOT_FOUND, если событий с таким cart_id нет.
 */
export const byId = adminProcedure
  .input(z.object({ id: z.string().min(1).max(64) }))
  .handler(async ({ context, input }) => {
    const events = await context.db
      .select({
        id: cartEvents.id,
        action: cartEvents.action,
        changes: cartEvents.changes,
        items: cartEvents.items,
        orderId: cartEvents.orderId,
        userId: cartEvents.userId,
        ip: cartEvents.ip,
        visitor: cartEvents.visitor,
        createdAt: cartEvents.createdAt,
      })
      .from(cartEvents)
      .where(eq(cartEvents.cartId, input.id))
      .orderBy(desc(cartEvents.createdAt), desc(cartEvents.id))
      .limit(EVENTS_LIMIT);
    const [latest] = events;
    if (!latest) {
      throw new ORPCError("NOT_FOUND", { message: "Корзина не найдена" });
    }

    const userIds = [...new Set(events.flatMap((event) => event.userId ?? []))];
    const orderIds = [
      ...new Set(events.flatMap((event) => event.orderId ?? [])),
    ];
    const [users, orders] = await Promise.all([
      userIds.length
        ? context.db
            .select({ id: user.id, name: user.name, email: user.email })
            .from(user)
            .where(inArray(user.id, userIds))
        : [],
      orderIds.length
        ? context.db
            .select({
              id: productOrders.id,
              number: productOrders.number,
              kind: productOrders.kind,
              status: productOrders.status,
              contactName: productOrders.contactName,
              contactPhone: productOrders.contactPhone,
              contactEmail: productOrders.contactEmail,
              amountTotal: productOrders.amountTotal,
              createdAt: productOrders.createdAt,
            })
            .from(productOrders)
            .where(inArray(productOrders.id, orderIds))
            .orderBy(desc(productOrders.createdAt))
        : [],
    ]);
    const orderNumbers = new Map(
      orders.map((order) => [order.id, order.number]),
    );

    return {
      cartId: input.id,
      items: latest.items,
      visitor: latest.visitor,
      lastAt: latest.createdAt,
      firstAt: events.at(-1)?.createdAt ?? latest.createdAt,
      truncated: events.length === EVENTS_LIMIT,
      users,
      orders,
      events: events.map(({ items: _items, userId: _userId, ...event }) => ({
        ...event,
        orderNumber: event.orderId
          ? (orderNumbers.get(event.orderId) ?? null)
          : null,
      })),
    };
  });
