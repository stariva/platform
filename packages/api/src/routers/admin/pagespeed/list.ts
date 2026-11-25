import { and, asc, count, desc, eq, type SQL, sql } from "@stariva/db";
import { pagespeedReports } from "@stariva/db/schema";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import {
  escapeLike,
  paginationSchema,
  querySchema,
  strategySchema,
} from "./shape";

const SORTS = ["worst", "best", "url", "recent"] as const;

/**
 * Последние оценки PageSpeed по каждой странице из sitemap в выбранной
 * стратегии. По умолчанию худшие первыми — раздел про то, над какими
 * страницами работать. Страницы, которые не удалось просканировать
 * (оценки null), в сортировке worst/best в конце.
 *
 * @example client.admin.pagespeed.list({ strategy: "mobile", sort: "worst", limit: 50, offset: 0 })
 */
export const list = adminProcedure
  .input(
    z.object({
      strategy: strategySchema.default("mobile"),
      sort: z.enum(SORTS).default("worst"),
      query: querySchema,
      limit: paginationSchema.shape.limit,
      offset: paginationSchema.shape.offset,
    }),
  )
  .handler(async ({ context, input }) => {
    // Последний прогон каждой страницы: DISTINCT ON по url
    const latest = context.db
      .selectDistinctOn([pagespeedReports.url])
      .from(pagespeedReports)
      .where(eq(pagespeedReports.strategy, input.strategy))
      .orderBy(pagespeedReports.url, desc(pagespeedReports.scannedAt))
      .as("latest");

    const filters: SQL[] = [];
    if (input.query) {
      filters.push(sql`${latest.url} ilike ${`%${escapeLike(input.query)}%`}`);
    }
    const where = and(...filters);

    const orderBy = {
      worst: [sql`${latest.performance} asc nulls last`],
      best: [sql`${latest.performance} desc nulls last`],
      url: [asc(latest.url)],
      recent: [desc(latest.scannedAt)],
    }[input.sort];

    const [items, [totals]] = await Promise.all([
      context.db
        .select()
        .from(latest)
        .where(where)
        .orderBy(...orderBy)
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ total: count() }).from(latest).where(where),
    ]);

    return { items, total: totals?.total ?? 0 };
  });
