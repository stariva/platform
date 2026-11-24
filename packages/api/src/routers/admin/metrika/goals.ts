import { and, count, desc, getTableColumns, type SQL, sql } from "@stariva/db";
import { metrikaGoals } from "@stariva/db/schema";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { escapeLike, paginationSchema, querySchema } from "./shape";

/**
 * Цели счётчика Метрики: id, название, тип и время синхронизации.
 * Название можно искать по подстроке.
 *
 * @example client.admin.metrika.goals.list({ query: "заказ", limit: 50, offset: 0 })
 */
export const list = adminProcedure
  .input(
    z.object({
      query: querySchema,
      limit: paginationSchema.shape.limit,
      offset: paginationSchema.shape.offset,
    }),
  )
  .handler(async ({ context, input }) => {
    const filters: SQL[] = [];
    if (input.query) {
      const pattern = `%${escapeLike(input.query)}%`;
      filters.push(
        sql`(
          ${metrikaGoals.name} ilike ${pattern}
          or ${metrikaGoals.type} ilike ${pattern}
        )`,
      );
    }

    const where = and(...filters);
    const { data: _data, ...columns } = getTableColumns(metrikaGoals);

    const [items, [totals]] = await Promise.all([
      context.db
        .select(columns)
        .from(metrikaGoals)
        .where(where)
        .orderBy(desc(metrikaGoals.id))
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ total: count() }).from(metrikaGoals).where(where),
    ]);

    return { items, total: totals?.total ?? 0 };
  });
