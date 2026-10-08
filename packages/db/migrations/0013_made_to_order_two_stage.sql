CREATE TYPE "public"."product_order_payment_type" AS ENUM('deposit', 'balance');--> statement-breakpoint
ALTER TYPE "public"."product_order_status" RENAME VALUE 'awaiting_details' TO 'requested';--> statement-breakpoint
ALTER TYPE "public"."product_order_status" ADD VALUE 'awaiting_deposit';--> statement-breakpoint
ALTER TYPE "public"."product_order_status" ADD VALUE 'awaiting_balance';--> statement-breakpoint
ALTER TYPE "public"."product_order_status" ADD VALUE 'declined';--> statement-breakpoint
CREATE TABLE "product_order_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"type" "product_order_payment_type" NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"yookassa_payment_id" text,
	"confirmation_url" text,
	"created_at" timestamp NOT NULL,
	"paid_at" timestamp,
	"staff_notified_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "deposit_amount" integer;--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "lead_time" text;--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "payment_due_at" timestamp;--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "deposit_paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "decline_reason" text;--> statement-breakpoint
ALTER TABLE "product_order_payments" ADD CONSTRAINT "product_order_payments_order_id_product_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."product_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_order_payments_order_idx" ON "product_order_payments" USING btree ("order_id");
