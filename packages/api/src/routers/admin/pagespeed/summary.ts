import { count, desc, eq, sql } from "@stariva/db";
import { pagespeedReports } from "@stariva/db/schema";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { strategySchema } from "./shape";

function toSafeInteger(value: unknown) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new RangeError("Pagespeed aggregate exceeds the safe integer range");
  }
  return number;
}

function toNullableSafeInteger(value: unknown) {
  return value == null ? null : toSafeInteger(value);
}

/**
 * Сводка по последним прогонам PageSpeed в стратегии: средние оценки,
 * сколько страниц хорошие (90+), средние (50–89) и плохие (<50), сколько
 * не просканировалось и когда был последний прогон.
 *
 * @example client.admin.pagespeed.summary({ strategy: "mobile" })
 */
export const summary = adminProcedure
  .input(z.object({ strategy: strategySchema.default("mobile") }))
  .handler(async ({ context, input }) => {
    const latest = context.db
      .selectDistinctOn([pagespeedReports.url])
      .from(pagespeedReports)
      .where(eq(pagespeedReports.strategy, input.strategy))
      .orderBy(pagespeedReports.url, desc(pagespeedReports.scannedAt))
      .as("latest");

    const [totals] = await context.db
      .select({
        pages: count(),
        avgPerformance: sql`round(avg(${latest.performance}))::int`.mapWith(
          toNullableSafeInteger,
        ),
        avgAccessibility: sql`round(avg(${latest.accessibility}))::int`.mapWith(
          toNullableSafeInteger,
        ),
        avgBestPractices: sql`round(avg(${latest.bestPractices}))::int`.mapWith(
          toNullableSafeInteger,
        ),
        avgSeo: sql`round(avg(${latest.seo}))::int`.mapWith(
          toNullableSafeInteger,
        ),
        good: sql`(count(*) filter (where ${latest.performance} >= 90))`.mapWith(
          toSafeInteger,
        ),
        average:
          sql`(count(*) filter (where ${latest.performance} >= 50 and ${latest.performance} < 90))`.mapWith(
            toSafeInteger,
          ),
        poor: sql`(count(*) filter (where ${latest.performance} < 50))`.mapWith(
          toSafeInteger,
        ),
        failed:
          sql`(count(*) filter (where ${latest.performance} is null))`.mapWith(
            toSafeInteger,
          ),
        lastScanAt: sql`max(${latest.scannedAt})`.mapWith(
          (value: string | Date | null): Date | null =>
            typeof value === "string" ? new Date(value) : value,
        ),
      })
      .from(latest);

    return (
      totals ?? {
        pages: 0,
        avgPerformance: null,
        avgAccessibility: null,
        avgBestPractices: null,
        avgSeo: null,
        good: 0,
        average: 0,
        poor: 0,
        failed: 0,
        lastScanAt: null,
      }
    );
  });
