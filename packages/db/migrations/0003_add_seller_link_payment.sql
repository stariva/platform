ALTER TABLE "product_orders" ADD COLUMN "payment_method" text DEFAULT 'yookassa' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "confirm_token" text;
