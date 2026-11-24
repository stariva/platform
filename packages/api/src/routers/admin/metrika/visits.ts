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
import { metrikaVisits } from "@stariva/db/schema";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { moscowDay } from "../crm/model";
import { daySchema, escapeLike, paginationSchema, querySchema } from "./shape";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Визиты Яндекс Метрики за период: с фильтром по клиенту, визиту, странице
 * или UTM-меткам. Свежие визиты сверху.
 *
 * @example client.admin.metrika.visits.list({ from: "2026-10-01", to: "2026-10-31", query: "yandex", limit: 50, offset: 0 })
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
      period.push(gte(metrikaVisits.startedAt, moscowDay(input.from)));
    }
    if (input.to) {
      period.push(
        lt(
          metrikaVisits.startedAt,
          new Date(moscowDay(input.to).getTime() + DAY),
        ),
      );
    }

    const filters = [...period];
    if (input.query) {
      const pattern = `%${escapeLike(input.query)}%`;
      filters.push(
        sql`(
          ${metrikaVisits.clientId} ilike ${pattern}
          or ${metrikaVisits.visitId} ilike ${pattern}
          or ${metrikaVisits.startUrl} ilike ${pattern}
          or ${metrikaVisits.endUrl} ilike ${pattern}
          or ${metrikaVisits.trafficSource} ilike ${pattern}
          or ${metrikaVisits.firstTrafficSource} ilike ${pattern}
          or ${metrikaVisits.utmSource} ilike ${pattern}
          or ${metrikaVisits.utmCampaign} ilike ${pattern}
          or ${metrikaVisits.city} ilike ${pattern}
          or ${metrikaVisits.deviceCategory} ilike ${pattern}
        )`,
      );
    }

    const where = and(...filters);

    // Поле data не нужно в списке: оно большое и не показывается
    const { data: _data, ...columns } = getTableColumns(metrikaVisits);

    const [items, [totals]] = await Promise.all([
      context.db
        .select(columns)
        .from(metrikaVisits)
        .where(where)
        .orderBy(desc(metrikaVisits.startedAt))
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ total: count() }).from(metrikaVisits).where(where),
    ]);

    return { items, total: totals?.total ?? 0 };
  });
