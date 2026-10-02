import { count, desc, ilike, or, sql, user } from "@stariva/db";
import { z } from "zod";

import { adminProcedure, isAdminEmail } from "../../../orpc";

/** Экранирует % и _ в поисковой строке, чтобы они искались как обычные символы. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Подзапрос «сколько строк таблицы у пользователя». Колонки пишем с именем
 * таблицы: без него drizzle печатает голые "user_id" = "id", и внутри
 * подзапроса "id" оказывается колонкой самой таблицы, а не пользователя.
 */
function countByUser(table: "product_orders" | "orders" | "course_access") {
  const from = sql.identifier(table);
  return sql<number>`(select count(*)::int from ${from} where ${from}.user_id = "users".id)`;
}

/**
 * Пользователи с постраничной выдачей и поиском по имени, почте и логину.
 * Для каждого — сколько у него заказов и курсов, и входит ли он в админы.
 *
 * @example client.admin.users.list({ query: "анна", limit: 25, offset: 0 })
 */
export const list = adminProcedure
  .input(
    z.object({
      query: z.string().trim().max(100).optional(),
      limit: z.number().int().min(1).max(100).default(25),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ context, input }) => {
    const pattern = input.query ? `%${escapeLike(input.query)}%` : null;
    const where = pattern
      ? or(
          ilike(user.name, pattern),
          ilike(user.email, pattern),
          ilike(user.username, pattern),
        )
      : undefined;

    const [rows, [totals]] = await Promise.all([
      context.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          image: user.image,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          productOrdersCount: countByUser("product_orders"),
          workshopOrdersCount: countByUser("orders"),
          coursesCount: countByUser("course_access"),
        })
        .from(user)
        .where(where)
        .orderBy(desc(user.createdAt), desc(user.id))
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ total: count() }).from(user).where(where),
    ]);

    return {
      items: rows.map((row) => ({
        ...row,
        isAdmin: isAdminEmail(row.email),
      })),
      total: totals?.total ?? 0,
    };
  });
