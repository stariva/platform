import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Оценки Google PageSpeed Insights для страниц из sitemap.xml витрины.
 * Воркер Hatchet (apps/jobs) прогоняет каждую страницу через PSI API раз
 * в день и шлёт результаты на сайт (jobs.pagespeed.report). Строка —
 * один прогон одной страницы в одной стратегии (mobile/desktop) за день;
 * повторный прогон в тот же день перезаписывает строку.
 *
 * Оценки — 0–100 по категориям Lighthouse (performance, accessibility,
 * best practices, seo). Метрики — лабораторные из Lighthouse: времена в
 * миллисекундах, CLS без единиц. При сбое сканирования оценки null,
 * а причина — в error.
 */
export const pagespeedReports = pgTable(
  "pagespeed_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull(),
    // mobile | desktop — стратегия прогона PSI
    strategy: text("strategy").notNull(),
    // День прогона по Москве: один прогон в день, ключ идемпотентности
    date: date("date", { mode: "string" }).notNull(),
    performance: integer("performance"),
    accessibility: integer("accessibility"),
    bestPractices: integer("best_practices"),
    seo: integer("seo"),
    // Миллисекунды
    firstContentfulPaint: numeric("first_contentful_paint", { mode: "number" }),
    largestContentfulPaint: numeric("largest_contentful_paint", {
      mode: "number",
    }),
    totalBlockingTime: numeric("total_blocking_time", { mode: "number" }),
    // Без единиц: 0 — идеально, хуже от 0.1
    cumulativeLayoutShift: numeric("cumulative_layout_shift", {
      mode: "number",
    }),
    speedIndex: numeric("speed_index", { mode: "number" }),
    // Страница не просканировалась: причина (квота, таймаут, ответ сайта)
    error: text("error"),
    scannedAt: timestamp("scanned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("pagespeed_reports_day_idx").on(t.url, t.strategy, t.date),
    index("pagespeed_reports_date_idx").on(t.date),
    // Последний прогон каждой страницы в стратегии: DISTINCT ON + scanned_at DESC
    index("pagespeed_reports_latest_idx").on(
      t.strategy,
      t.url,
      t.scannedAt.desc(),
    ),
  ],
);

export type PagespeedReportRow = typeof pagespeedReports.$inferSelect;
