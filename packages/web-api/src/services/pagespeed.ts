import { ORPCError } from "@orpc/server";
import { db, sql } from "@stariva/db";
import { pagespeedReports } from "@stariva/db/schema";
import type { PagespeedResult } from "../contract/jobs";
import { moscowDate } from "./yandex/common";

// Воркер может немного расходиться по часам с сайтом, но не на сутки
const SCAN_TIME_TOLERANCE_MS = 24 * 60 * 60 * 1000;

function excluded(column: { name: string }) {
  return sql.raw(`excluded."${column.name.replace(/"/g, '""')}"`);
}

function validScannedAt(value: string): Date {
  const scannedAt = new Date(value);
  const skew = Math.abs(Date.now() - scannedAt.getTime());
  if (Number.isNaN(scannedAt.getTime()) || skew > SCAN_TIME_TOLERANCE_MS) {
    throw new ORPCError("BAD_REQUEST", {
      message: "pagespeed_scanned_at_out_of_range",
    });
  }
  return scannedAt;
}

/**
 * Записывает пачку оценок PageSpeed от воркера. Ключ идемпотентности —
 * страница + стратегия + день по Москве: повторная отправка той же пачки
 * или повторный прогон в тот же день обновляют строку, если время прогона
 * не раньше сохранённого.
 */
export async function savePagespeedResults(
  results: PagespeedResult[],
): Promise<number> {
  // День прогона определяет только сервер: ключ идемпотентности нельзя
  // менять со стороны воркера, даже если у него съехали часы
  const date = moscowDate(new Date());
  const seen = new Set<string>();
  const rows = results.map((r) => {
    const key = JSON.stringify([r.url, r.strategy, date]);
    if (seen.has(key)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "pagespeed_duplicate_report",
      });
    }
    seen.add(key);
    const scannedAt = validScannedAt(r.scannedAt);
    return {
      url: r.url,
      strategy: r.strategy,
      date,
      performance: r.performance,
      accessibility: r.accessibility,
      bestPractices: r.bestPractices,
      seo: r.seo,
      firstContentfulPaint: r.firstContentfulPaint,
      largestContentfulPaint: r.largestContentfulPaint,
      totalBlockingTime: r.totalBlockingTime,
      cumulativeLayoutShift: r.cumulativeLayoutShift,
      speedIndex: r.speedIndex,
      error: r.error,
      scannedAt,
    };
  });

  await db
    .insert(pagespeedReports)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        pagespeedReports.url,
        pagespeedReports.strategy,
        pagespeedReports.date,
      ],
      setWhere: sql`${excluded(pagespeedReports.scannedAt)} >= ${pagespeedReports.scannedAt}`,
      set: {
        performance: excluded(pagespeedReports.performance),
        accessibility: excluded(pagespeedReports.accessibility),
        bestPractices: excluded(pagespeedReports.bestPractices),
        seo: excluded(pagespeedReports.seo),
        firstContentfulPaint: excluded(pagespeedReports.firstContentfulPaint),
        largestContentfulPaint: excluded(
          pagespeedReports.largestContentfulPaint,
        ),
        totalBlockingTime: excluded(pagespeedReports.totalBlockingTime),
        cumulativeLayoutShift: excluded(pagespeedReports.cumulativeLayoutShift),
        speedIndex: excluded(pagespeedReports.speedIndex),
        error: excluded(pagespeedReports.error),
        scannedAt: excluded(pagespeedReports.scannedAt),
      },
    });

  return rows.length;
}
