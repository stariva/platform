CREATE TYPE "public"."product_order_kind" AS ENUM('stock', 'made_to_order');--> statement-breakpoint
ALTER TYPE "public"."product_delivery_method" ADD VALUE 'manual';--> statement-breakpoint
ALTER TYPE "public"."product_order_status" ADD VALUE 'awaiting_details';--> statement-breakpoint
ALTER TYPE "public"."product_order_status" ADD VALUE 'in_production';--> statement-breakpoint
ALTER TYPE "public"."product_order_status" ADD VALUE 'ready_to_ship';--> statement-breakpoint
ALTER TABLE "product_order_items" ALTER COLUMN "ozon_sku" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_order_items" ADD COLUMN "options" jsonb;--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "kind" "product_order_kind" DEFAULT 'stock' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "customer_notes" text;--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "delivery_note" text;--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "master_notes" text;--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "staff_notified_at" timestamp;