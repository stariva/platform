ALTER TABLE "email_log" ADD COLUMN "open_token" text;--> statement-breakpoint
ALTER TABLE "email_log" ADD COLUMN "first_opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_log" ADD COLUMN "open_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "email_log_open_token_idx" ON "email_log" USING btree ("open_token");