CREATE TYPE "public"."product_delivery_method" AS ENUM('pickup', 'courier');--> statement-breakpoint
CREATE TYPE "public"."product_order_status" AS ENUM('pending', 'paid', 'canceled', 'refunded', 'ozon_order_failed', 'fulfilling', 'shipped', 'delivered');--> statement-breakpoint
CREATE TABLE "product_order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_slug" text NOT NULL,
	"ozon_sku" integer NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"contact_email" text,
	"status" "product_order_status" DEFAULT 'pending' NOT NULL,
	"amount_products" integer NOT NULL,
	"amount_delivery" integer DEFAULT 0 NOT NULL,
	"amount_total" integer NOT NULL,
	"currency" text DEFAULT 'RUB' NOT NULL,
	"payment_id" text,
	"delivery_method" "product_delivery_method" NOT NULL,
	"delivery_point_id" text,
	"delivery_address" jsonb,
	"checkout_snapshot" jsonb,
	"ozon_order_id" text,
	"ozon_posting_numbers" text[],
	"created_at" timestamp NOT NULL,
	"paid_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "product_order_items" ADD CONSTRAINT "product_order_items_order_id_product_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."product_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_orders" ADD CONSTRAINT "product_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;