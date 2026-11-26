CREATE TABLE "site_health_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"url" text NOT NULL,
	"date" date NOT NULL,
	"severity" text NOT NULL,
	"code" text NOT NULL,
	"message" text NOT NULL,
	"target" text DEFAULT '' NOT NULL,
	"details" jsonb,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_health_findings_dedupe_idx" UNIQUE("date","url","code","target")
);
--> statement-breakpoint
CREATE TABLE "site_health_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"date" date NOT NULL,
	"status" integer,
	"final_url" text,
	"redirect_count" integer,
	"response_time_ms" integer,
	"title" text,
	"meta_description" text,
	"canonical" text,
	"robots" text,
	"h1_count" integer,
	"internal_links" integer,
	"broken_links" integer,
	"images" integer,
	"broken_images" integer,
	"missing_alt_images" integer,
	"error" text,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_health_pages_day_idx" UNIQUE("url","date")
);
--> statement-breakpoint
ALTER TABLE "site_health_findings" ADD CONSTRAINT "site_health_findings_page_id_site_health_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."site_health_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_health_findings_page_idx" ON "site_health_findings" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "site_health_findings_date_idx" ON "site_health_findings" USING btree ("date");--> statement-breakpoint
CREATE INDEX "site_health_findings_url_idx" ON "site_health_findings" USING btree ("url");--> statement-breakpoint
CREATE INDEX "site_health_pages_date_idx" ON "site_health_pages" USING btree ("date");--> statement-breakpoint
CREATE INDEX "site_health_pages_latest_idx" ON "site_health_pages" USING btree ("url","scanned_at" DESC NULLS LAST);