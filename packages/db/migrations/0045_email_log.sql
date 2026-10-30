CREATE TABLE "email_log" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"status" text NOT NULL,
	"provider" text,
	"attempts" jsonb NOT NULL,
	"error" text,
	"attachments" integer DEFAULT 0 NOT NULL,
	"idempotency_key" text,
	"workshop_order_id" text,
	"kind" text,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_log_created_idx" ON "email_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_log_status_created_idx" ON "email_log" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "email_log_workshop_order_idx" ON "email_log" USING btree ("workshop_order_id");