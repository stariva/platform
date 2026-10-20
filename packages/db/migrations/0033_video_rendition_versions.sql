ALTER TABLE "video_renditions" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "video_renditions" ADD COLUMN "ready_hls_prefix" text;--> statement-breakpoint
ALTER TABLE "video_renditions" ADD COLUMN "ready_version" integer;--> statement-breakpoint
-- Готовые нарезки (одно качество) продолжают показываться, пока их перерезают
UPDATE "video_renditions" SET "ready_hls_prefix" = "hls_prefix", "ready_version" = 1 WHERE "status" = 'ready';
