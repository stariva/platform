CREATE TABLE "email_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"type" text NOT NULL,
	"recipients" text[] DEFAULT '{}' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_stream_cursors" (
	"stream" text NOT NULL,
	"shard_id" text NOT NULL,
	"sequence_number" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_stream_cursors_stream_shard_id_pk" PRIMARY KEY("stream","shard_id")
);
--> statement-breakpoint
ALTER TABLE "email_log" ADD COLUMN "message_id" text;--> statement-breakpoint
ALTER TABLE "email_log" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_log" ADD COLUMN "delayed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_log" ADD COLUMN "bounced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_log" ADD COLUMN "bounce_type" text;--> statement-breakpoint
ALTER TABLE "email_log" ADD COLUMN "bounce_detail" text;--> statement-breakpoint
ALTER TABLE "email_log" ADD COLUMN "complained_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "email_events_created_idx" ON "email_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_events_message_idx" ON "email_events" USING btree ("message_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_log_message_id_uq" ON "email_log" USING btree ("message_id");