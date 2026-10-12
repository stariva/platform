ALTER TABLE "product_orders" ADD COLUMN "visitor" jsonb;--> statement-breakpoint
ALTER TABLE "custom_order_requests" ADD COLUMN "visitor" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "visitor" jsonb;