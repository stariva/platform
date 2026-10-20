import { count, desc, ilike, loginEvent, or, sql, user } from "@stariva/db";
import { z } from "zod";

import { adminProcedure, isAdminUser } from "../../../orpc";

const USER_SORTS = ["created", "lastSignIn"] as const;

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
 * Последний вход: самый поздний sign_in из журнала или начало сессии.
 * Журнал входов ведётся с октября 2026, а сессии помнят и более ранние входы;
 * greatest пропускает null, так что хватает любого из двух источников.
 * Результат — timestamptz (sessions без пояса приводится к нему в UTC),
 * поэтому разбираем его как колонку с поясом, а не как users.created_at.
 */
const lastSignInAt = sql<Date | null>`greatest(
  (select max("login_events"."created_at") from "login_events"
    where "login_events"."user_id" = "users".id and "login_events"."type" = 'sign_in'),
  (select max("sessions"."created_at") from "sessions"
    where "sessions"."user_id" = "users".id)
)`.mapWith(loginEvent.createdAt);

/**
 * Пользователи с постраничной выдачей и поиском по имени, почте и логину.
 * Для каждого — сколько у него заказов и курсов, когда он последний раз
 * входил и входит ли он в админы.
 *
 * Сортировка — по дате регистрации или последнего входа, от новых к старым;
 * кто ни разу не входил, идёт в конце.
 *
 * @example client.admin.users.list({ query: "анна", sort: "lastSignIn", limit: 25, offset: 0 })
 */
export const list = adminProcedure
  .input(
    z.object({
      query: z.string().trim().max(100).optional(),
      limit: z.number().int().min(1).max(100).default(25),
      offset: z.number().int().min(0).default(0),
      sort: z.enum(USER_SORTS).default("created"),
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
          lastSignInAt,
          productOrdersCount: countByUser("product_orders"),
          workshopOrdersCount: countByUser("orders"),
          coursesCount: countByUser("course_access"),
        })
        .from(user)
        .where(where)
        .orderBy(
          ...(input.sort === "lastSignIn"
            ? [sql`${lastSignInAt} desc nulls last`, desc(user.createdAt)]
            : [desc(user.createdAt)]),
          desc(user.id),
        )
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ total: count() }).from(user).where(where),
    ]);

    return {
      items: rows.map((row) => ({
        ...row,
        isAdmin: isAdminUser(row),
      })),
      total: totals?.total ?? 0,
    };
  });
