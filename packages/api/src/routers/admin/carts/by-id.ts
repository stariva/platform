import { ORPCError } from "@orpc/server";
import {
  adCampaigns,
  cartEvents,
  desc,
  eq,
  inArray,
  productOrders,
  user,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { clickSource, siteOf } from "../contact-clicks/model";
import { byId as byIdMap, sourceView } from "../crm/shape";

/** Больше событий одной корзины в карточке не показываем. */
const EVENTS_LIMIT = 500;

/**
 * Одна корзина целиком: события от новых к старым (что положил, убрал,
 * оформил, откуда и с какой рекламы), аккаунт, если посетитель входил, и
 * заказы, которыми закончились оформления. Реклама корзины — та, с которой
 * пришли впервые; нет её — источник последнего события.
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
        entry: cartEvents.entry,
        attribution: cartEvents.attribution,
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
    const [users, orders, campaigns] = await Promise.all([
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
      context.db.select().from(adCampaigns),
    ]);
    const campaignsById = byIdMap(campaigns);
    const sourceOf = (
      event: Pick<(typeof events)[number], "entry" | "attribution">,
    ) => ({
      campaign: sourceView(
        clickSource(event.entry, event.attribution, campaigns),
        campaignsById,
      ),
      site: siteOf(event.entry),
      entry: event.entry,
      attribution: event.attribution,
    });
    const sources = events.map(sourceOf);
    const source =
      [...sources].reverse().find((item) => item.campaign.kind !== "none") ??
      sourceOf(latest);
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
      source,
      events: events.map(
        ({ items: _items, userId: _userId, entry, attribution, ...event }) => ({
          ...event,
          source: sourceOf({ ...event, entry, attribution }),
          orderNumber: event.orderId
            ? (orderNumbers.get(event.orderId) ?? null)
            : null,
        }),
      ),
    };
  });
