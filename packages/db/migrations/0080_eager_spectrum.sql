CREATE TABLE "pagespeed_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"strategy" text NOT NULL,
	"date" date NOT NULL,
	"performance" integer,
	"accessibility" integer,
	"best_practices" integer,
	"seo" integer,
	"first_contentful_paint" numeric,
	"largest_contentful_paint" numeric,
	"total_blocking_time" numeric,
	"cumulative_layout_shift" numeric,
	"speed_index" numeric,
	"error" text,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pagespeed_reports_day_idx" UNIQUE("url","strategy","date")
);
--> statement-breakpoint
CREATE INDEX "pagespeed_reports_date_idx" ON "pagespeed_reports" USING btree ("date");