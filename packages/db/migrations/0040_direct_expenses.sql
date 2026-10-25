ALTER TABLE "ad_campaigns" ADD COLUMN "direct_campaign_id" bigint;--> statement-breakpoint
ALTER TABLE "ad_expenses" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ad_campaigns_direct_campaign_idx" ON "ad_campaigns" USING btree ("direct_campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_expenses_direct_day_idx" ON "ad_expenses" USING btree ("campaign_id","spent_on") WHERE "ad_expenses"."source" = 'yandex_direct';