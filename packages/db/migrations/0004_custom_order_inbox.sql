CREATE TABLE "custom_order_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"data" jsonb NOT NULL,
	"message" text NOT NULL,
	"photo_base64" text,
	"photo_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "custom_order_retry_idx" ON "custom_order_requests" USING btree ("delivered_at","next_attempt_at");