CREATE TABLE "workshop_order_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"kind" text NOT NULL,
	"channel" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workshop_order_notifications_uq" UNIQUE("order_id","kind","channel")
);
--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "release_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "access_token" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "telegram_token" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "telegram_chat_id" text;--> statement-breakpoint
ALTER TABLE "workshop_order_notifications" ADD CONSTRAINT "workshop_order_notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_access_token_idx" ON "orders" USING btree ("access_token");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_telegram_token_idx" ON "orders" USING btree ("telegram_token");