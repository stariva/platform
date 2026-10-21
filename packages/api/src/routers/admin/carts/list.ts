import {
  type CartEventItem,
  cartEvents,
  count,
  desc,
  eq,
  productOrders,
  type SQL,
  sql,
  user,
  type VisitorInfo,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

/** Экранирует % и _ в поисковой строке, чтобы они искались как обычные символы. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export const CART_STATUSES = ["with_items", "ordered"] as const;

/** Последнее непустое значение столбца в группе событий одной корзины. */
const latestOf = <T>(column: SQL) =>
  sql<T>`(array_agg(${column} order by ${cartEvents.createdAt} desc) filter (where ${column} is not null))[1]`;

/**
 * Корзины посетителей, свежие сверху. Строка — один браузер (cart_id): что
 * лежит в корзине сейчас, кто это (аккаунт, заказ, город и устройство),
 * когда клал и чем кончилось. Поиск — по названиям товаров во всех событиях,
 * IP, аккаунту и контактам заказа.
 *
 * Вместе со страницей отдаёт сводку по всем корзинам: сколько их, сколько
 * с товарами сейчас и сколько дошли до заказа.
 *
 * @example client.admin.carts.list({ status: "with_items", limit: 50, offset: 0 })
 */
export const list = adminProcedure
  .input(
    z.object({
      status: z.enum(CART_STATUSES).optional(),
      query: z.string().trim().max(100).optional(),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ context, input }) => {
    const carts = context.db
      .select({
        cartId: cartEvents.cartId,
        firstAt: sql<Date>`min(${cartEvents.createdAt})`
          .mapWith(cartEvents.createdAt)
          .as("cart_first_at"),
        lastAt: sql<Date>`max(${cartEvents.createdAt})`
          .mapWith(cartEvents.createdAt)
          .as("cart_last_at"),
        eventsCount: sql<number>`count(*)::int`.as("cart_events_count"),
        userId: latestOf<string | null>(sql`${cartEvents.userId}`).as(
          "cart_user_id",
        ),
        orderId: latestOf<string | null>(sql`${cartEvents.orderId}`).as(
          "cart_order_id",
        ),
        ordersCount: sql<number>`count(distinct ${cartEvents.orderId})::int`.as(
          "cart_orders_count",
        ),
        items: sql<
          CartEventItem[]
        >`(array_agg(${cartEvents.items} order by ${cartEvents.createdAt} desc))[1]`.as(
          "cart_items",
        ),
        visitor: latestOf<VisitorInfo | null>(sql`${cartEvents.visitor}`).as(
          "cart_visitor",
        ),
      })
      .from(cartEvents)
      .groupBy(cartEvents.cartId)
      .as("c");

    const filters: SQL[] = [];
    if (input.status === "with_items") {
      filters.push(sql`jsonb_array_length(${carts.items}) > 0`);
    }
    if (input.status === "ordered") {
      filters.push(sql`${carts.ordersCount} > 0`);
    }
    if (input.query) {
      // jsonb в текстовом виде хранит кириллицу как есть
      const pattern = `%${escapeLike(input.query)}%`;
      filters.push(sql`(
        exists (
          select 1 from ${cartEvents} e
          where e.cart_id = ${carts.cartId}
            and (e.items::text ilike ${pattern} or e.changes::text ilike ${pattern} or e.ip ilike ${pattern})
        )
        or ${user.name} ilike ${pattern}
        or ${user.email} ilike ${pattern}
        or ${productOrders.contactName} ilike ${pattern}
        or ${productOrders.contactPhone} ilike ${pattern}
      )`);
    }
    const where =
      filters.length > 0 ? sql.join(filters, sql` and `) : undefined;

    const [rows, [totals], [summary]] = await Promise.all([
      context.db
        .select({
          cartId: carts.cartId,
          firstAt: carts.firstAt,
          lastAt: carts.lastAt,
          eventsCount: carts.eventsCount,
          items: carts.items,
          visitor: carts.visitor,
          ordersCount: carts.ordersCount,
          userId: carts.userId,
          userName: user.name,
          userEmail: user.email,
          orderId: carts.orderId,
          orderNumber: productOrders.number,
          orderStatus: productOrders.status,
          contactName: productOrders.contactName,
          contactPhone: productOrders.contactPhone,
        })
        .from(carts)
        .leftJoin(user, eq(user.id, carts.userId))
        .leftJoin(productOrders, eq(productOrders.id, carts.orderId))
        .where(where)
        .orderBy(desc(carts.lastAt), desc(carts.cartId))
        .limit(input.limit)
        .offset(input.offset),
      context.db
        .select({ total: count() })
        .from(carts)
        .leftJoin(user, eq(user.id, carts.userId))
        .leftJoin(productOrders, eq(productOrders.id, carts.orderId))
        .where(where),
      context.db
        .select({
          carts: count(),
          withItems: sql<number>`(count(*) filter (where jsonb_array_length(${carts.items}) > 0))::int`,
          ordered: sql<number>`(count(*) filter (where ${carts.ordersCount} > 0))::int`,
        })
        .from(carts),
    ]);

    return {
      items: rows,
      total: totals?.total ?? 0,
      summary: {
        carts: summary?.carts ?? 0,
        withItems: summary?.withItems ?? 0,
        ordered: summary?.ordered ?? 0,
      },
    };
  });
