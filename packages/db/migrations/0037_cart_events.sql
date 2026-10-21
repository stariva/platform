CREATE TABLE "cart_events" (
	"id" text PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"changes" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	"order_id" text,
	"ip" text,
	"visitor" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_events" ADD CONSTRAINT "cart_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_events" ADD CONSTRAINT "cart_events_order_id_product_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."product_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cart_events_cart_created_idx" ON "cart_events" USING btree ("cart_id","created_at");--> statement-breakpoint
CREATE INDEX "cart_events_created_idx" ON "cart_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cart_events_user_id_idx" ON "cart_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cart_events_order_id_idx" ON "cart_events" USING btree ("order_id");