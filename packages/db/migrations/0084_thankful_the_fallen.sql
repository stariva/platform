CREATE TYPE "public"."promo_discount_type" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"discount_type" "promo_discount_type" NOT NULL,
	"discount_value" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"min_order_amount" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_code_format" CHECK ("promo_codes"."code" ~ '^[A-Z0-9][A-Z0-9-]{2,39}$'),
	CONSTRAINT "promo_codes_discount_positive" CHECK ("promo_codes"."discount_value" > 0),
	CONSTRAINT "promo_codes_percent_range" CHECK ("promo_codes"."discount_type" <> 'percent' OR "promo_codes"."discount_value" <= 100),
	CONSTRAINT "promo_codes_usage_limit_positive" CHECK ("promo_codes"."usage_limit" IS NULL OR "promo_codes"."usage_limit" > 0),
	CONSTRAINT "promo_codes_min_order_positive" CHECK ("promo_codes"."min_order_amount" IS NULL OR "promo_codes"."min_order_amount" > 0),
	CONSTRAINT "promo_codes_period_order" CHECK ("promo_codes"."starts_at" IS NULL OR "promo_codes"."ends_at" IS NULL OR "promo_codes"."ends_at" > "promo_codes"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "amount_discount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "promo_code" text;--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "promo_code_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "promo_codes_code_idx" ON "promo_codes" USING btree ("code");--> statement-breakpoint
ALTER TABLE "product_orders" ADD CONSTRAINT "product_orders_promo_code_id_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE set null ON UPDATE no action NOT VALID;--> statement-breakpoint
CREATE INDEX "product_orders_promo_code_idx" ON "product_orders" USING btree ("promo_code_id");--> statement-breakpoint
ALTER TABLE "product_orders" ADD CONSTRAINT "product_orders_discount_range" CHECK ("product_orders"."amount_discount" >= 0 AND "product_orders"."amount_discount" <= "product_orders"."amount_products") NOT VALID;