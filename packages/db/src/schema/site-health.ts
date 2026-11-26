import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const SITE_HEALTH_SEVERITIES = [
  "critical",
  "warning",
  "notice",
] as const;
export type SiteHealthSeverity = (typeof SITE_HEALTH_SEVERITIES)[number];

export const siteHealthPages = pgTable(
  "site_health_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    status: integer("status"),
    finalUrl: text("final_url"),
    redirectCount: integer("redirect_count"),
    responseTimeMs: integer("response_time_ms"),
    title: text("title"),
    metaDescription: text("meta_description"),
    canonical: text("canonical"),
    robots: text("robots"),
    h1Count: integer("h1_count"),
    internalLinks: integer("internal_links"),
    brokenLinks: integer("broken_links"),
    images: integer("images"),
    brokenImages: integer("broken_images"),
    missingAltImages: integer("missing_alt_images"),
    error: text("error"),
    scannedAt: timestamp("scanned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("site_health_pages_day_idx").on(t.url, t.date),
    index("site_health_pages_date_idx").on(t.date),
    index("site_health_pages_latest_idx").on(t.url, t.scannedAt.desc()),
  ],
);

export const siteHealthFindings = pgTable(
  "site_health_findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => siteHealthPages.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    severity: text("severity", { enum: SITE_HEALTH_SEVERITIES }).notNull(),
    code: text("code").notNull(),
    message: text("message").notNull(),
    target: text("target").notNull().default(""),
    details: jsonb("details").$type<Record<string, unknown>>(),
    scannedAt: timestamp("scanned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("site_health_findings_dedupe_idx").on(
      t.date,
      t.url,
      t.code,
      t.target,
    ),
    index("site_health_findings_page_idx").on(t.pageId),
    index("site_health_findings_date_idx").on(t.date),
    index("site_health_findings_url_idx").on(t.url),
  ],
);

export type SiteHealthPageRow = typeof siteHealthPages.$inferSelect;
export type SiteHealthFindingRow = typeof siteHealthFindings.$inferSelect;
