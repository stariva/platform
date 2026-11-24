import {
  and,
  count,
  desc,
  getTableColumns,
  gte,
  lt,
  type SQL,
  sql,
} from "@stariva/db";
import { metrikaHits } from "@stariva/db/schema";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { moscowDay } from "../crm/model";
import { daySchema, escapeLike, paginationSchema, querySchema } from "./shape";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Просмотры страниц и события (hits) Метрики за период: фильтр по клиенту,
 * визиту, URL или заголовку. Свежие сверху.
 *
 * @example client.admin.metrika.hits.list({ from: "2026-10-01", to: "2026-10-31", query: "/catalog", limit: 50, offset: 0 })
 */
export const list = adminProcedure
  .input(
    z.object({
      from: daySchema.optional(),
      to: daySchema.optional(),
      query: querySchema,
      limit: paginationSchema.shape.limit,
      offset: paginationSchema.shape.offset,
    }),
  )
  .handler(async ({ context, input }) => {
    const period: SQL[] = [];
    if (input.from) {
      period.push(gte(metrikaHits.at, moscowDay(input.from)));
    }
    if (input.to) {
      period.push(
        lt(metrikaHits.at, new Date(moscowDay(input.to).getTime() + DAY)),
      );
    }

    const filters = [...period];
    if (input.query) {
      const pattern = `%${escapeLike(input.query)}%`;
      filters.push(
        sql`(
          ${metrikaHits.clientId} ilike ${pattern}
          or ${metrikaHits.visitId} ilike ${pattern}
          or ${metrikaHits.url} ilike ${pattern}
          or ${metrikaHits.title} ilike ${pattern}
        )`,
      );
    }

    const where = and(...filters);

    const { data: _data, ...columns } = getTableColumns(metrikaHits);

    const [items, [totals]] = await Promise.all([
      context.db
        .select(columns)
        .from(metrikaHits)
        .where(where)
        .orderBy(desc(metrikaHits.at))
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ total: count() }).from(metrikaHits).where(where),
    ]);

    return { items, total: totals?.total ?? 0 };
  });
