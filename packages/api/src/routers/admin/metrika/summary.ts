import { and, count, desc, gte, lt, type SQL, sql } from "@stariva/db";
import { metrikaGoals, metrikaHits, metrikaVisits } from "@stariva/db/schema";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { moscowDay } from "../crm/model";
import { daySchema } from "./shape";

const DAY = 24 * 60 * 60 * 1000;

function toSafeInteger(value: unknown) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new RangeError("Metrika aggregate exceeds the safe integer range");
  }
  return number;
}

/**
 * Сводная аналитика по Метрике за период: визиты, просмотры, топ-источники,
 * города, устройства и самые посещаемые страницы.
 *
 * @example client.admin.metrika.summary({ from: "2026-10-01", to: "2026-10-31" })
 */
export const summary = adminProcedure
  .input(
    z.object({
      from: daySchema.optional(),
      to: daySchema.optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    const visitFilters: SQL[] = [];
    if (input.from) {
      visitFilters.push(gte(metrikaVisits.startedAt, moscowDay(input.from)));
    }
    if (input.to) {
      visitFilters.push(
        lt(
          metrikaVisits.startedAt,
          new Date(moscowDay(input.to).getTime() + DAY),
        ),
      );
    }
    const visitWhere = and(...visitFilters);

    const hitFilters: SQL[] = [];
    if (input.from) {
      hitFilters.push(gte(metrikaHits.at, moscowDay(input.from)));
    }
    if (input.to) {
      hitFilters.push(
        lt(metrikaHits.at, new Date(moscowDay(input.to).getTime() + DAY)),
      );
    }
    const hitWhere = and(...hitFilters);

    const [
      [visitTotals],
      [hitTotals],
      topSources,
      topFirstSources,
      topCities,
      topDevices,
      topPages,
      goals,
    ] = await Promise.all([
      context.db
        .select({
          total: count(),
          uniqueClients:
            sql`(count(distinct ${metrikaVisits.clientId}))`.mapWith(
              toSafeInteger,
            ),
          newUsers:
            sql`coalesce(sum(case when ${metrikaVisits.isNewUser} = true then 1 else 0 end), 0)`.mapWith(
              toSafeInteger,
            ),
          bounces:
            sql`coalesce(sum(case when ${metrikaVisits.bounce} = true then 1 else 0 end), 0)`.mapWith(
              toSafeInteger,
            ),
          pageViews: sql`coalesce(sum(${metrikaVisits.pageViews}), 0)`.mapWith(
            toSafeInteger,
          ),
          durationSeconds:
            sql`coalesce(sum(${metrikaVisits.duration}), 0)`.mapWith(
              toSafeInteger,
            ),
          avgDurationSeconds: sql<number>`round(coalesce(avg(${metrikaVisits.duration}), 0))::int`,
          withGoals:
            sql`(count(*) filter (where array_length(${metrikaVisits.goalIds}, 1) > 0))`.mapWith(
              toSafeInteger,
            ),
        })
        .from(metrikaVisits)
        .where(visitWhere),

      context.db
        .select({
          total: count(),
          pageViews:
            sql`coalesce(sum(case when ${metrikaHits.isPageView} = true then 1 else 0 end), 0)`.mapWith(
              toSafeInteger,
            ),
          events:
            sql`coalesce(sum(case when ${metrikaHits.isPageView} is distinct from true then 1 else 0 end), 0)`.mapWith(
              toSafeInteger,
            ),
        })
        .from(metrikaHits)
        .where(hitWhere),

      context.db
        .select({
          source: metrikaVisits.trafficSource,
          visits: count(),
        })
        .from(metrikaVisits)
        .where(and(visitWhere, sql`${metrikaVisits.trafficSource} is not null`))
        .groupBy(metrikaVisits.trafficSource)
        .orderBy(desc(count()))
        .limit(10),

      context.db
        .select({
          source: metrikaVisits.firstTrafficSource,
          visits: count(),
        })
        .from(metrikaVisits)
        .where(
          and(visitWhere, sql`${metrikaVisits.firstTrafficSource} is not null`),
        )
        .groupBy(metrikaVisits.firstTrafficSource)
        .orderBy(desc(count()))
        .limit(10),

      context.db
        .select({
          city: metrikaVisits.city,
          visits: count(),
        })
        .from(metrikaVisits)
        .where(and(visitWhere, sql`${metrikaVisits.city} is not null`))
        .groupBy(metrikaVisits.city)
        .orderBy(desc(count()))
        .limit(10),

      context.db
        .select({
          device: metrikaVisits.deviceCategory,
          visits: count(),
        })
        .from(metrikaVisits)
        .where(
          and(visitWhere, sql`${metrikaVisits.deviceCategory} is not null`),
        )
        .groupBy(metrikaVisits.deviceCategory)
        .orderBy(desc(count()))
        .limit(10),

      context.db
        .select({
          url: metrikaHits.url,
          title: sql<string | null>`max(${metrikaHits.title})`,
          hits: count(),
        })
        .from(metrikaHits)
        .where(
          and(
            hitWhere,
            sql`${metrikaHits.isPageView} = true and ${metrikaHits.url} is not null`,
          ),
        )
        .groupBy(metrikaHits.url)
        .orderBy(desc(count()))
        .limit(10),

      context.db
        .select({ id: metrikaGoals.id, name: metrikaGoals.name })
        .from(metrikaGoals)
        .orderBy(metrikaGoals.id),
    ]);

    return {
      visits: visitTotals ?? {
        total: 0,
        uniqueClients: 0,
        newUsers: 0,
        bounces: 0,
        pageViews: 0,
        durationSeconds: 0,
        avgDurationSeconds: 0,
        withGoals: 0,
      },
      hits: hitTotals ?? {
        total: 0,
        pageViews: 0,
        events: 0,
      },
      topSources: topSources.map((row) => ({
        source: row.source,
        visits: row.visits,
      })),
      topFirstSources: topFirstSources.map((row) => ({
        source: row.source,
        visits: row.visits,
      })),
      topCities: topCities.map((row) => ({
        city: row.city,
        visits: row.visits,
      })),
      topDevices: topDevices.map((row) => ({
        device: row.device,
        visits: row.visits,
      })),
      topPages: topPages.map((row) => ({
        url: row.url,
        title: row.title,
        hits: row.hits,
      })),
      goals,
    };
  });
