ALTER TABLE "product_orders" ADD COLUMN "ozon_shipment_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "ozon_shipment_attempt_id" text;--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "ozon_shipment_attempted_at" timestamp;
--> statement-breakpoint
UPDATE "product_orders"
SET "ozon_shipment_status" = 'failed'
WHERE "status" = 'ozon_order_failed';
