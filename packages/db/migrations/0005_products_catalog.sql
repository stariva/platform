CREATE TYPE "public"."product_category" AS ENUM('clothes', 'interior', 'bags');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."product_subcategory" AS ENUM('dresses', 'tops', 'belts', 'lampshades', 'tipis', 'pannos', 'placemats', 'planters', 'baskets', 'totes', 'crossbody');--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" "product_category" NOT NULL,
	"subcategory" "product_subcategory" NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"price" integer NOT NULL,
	"old_price" integer,
	"images" text[] DEFAULT '{}'::text[] NOT NULL,
	"material" text,
	"color" text,
	"dimensions" text,
	"care_instructions" text,
	"sizes" text[] DEFAULT '{}'::text[] NOT NULL,
	"made_to_order" boolean DEFAULT true NOT NULL,
	"lead_time_min_days" integer,
	"lead_time_max_days" integer,
	"ozon_product_id" bigint,
	"ozon_offer_id" text,
	"ozon_sku" bigint,
	"stock_available" integer DEFAULT 0 NOT NULL,
	"stock_synced_at" timestamp with time zone,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_positive" CHECK ("products"."price" > 0),
	CONSTRAINT "products_old_price_gt_price" CHECK ("products"."old_price" IS NULL OR "products"."old_price" > "products"."price"),
	CONSTRAINT "products_stock_non_negative" CHECK ("products"."stock_available" >= 0),
	CONSTRAINT "products_lead_time_range" CHECK (("products"."lead_time_min_days" IS NULL) = ("products"."lead_time_max_days" IS NULL)
        AND ("products"."lead_time_min_days" IS NULL
          OR ("products"."lead_time_min_days" > 0 AND "products"."lead_time_min_days" <= "products"."lead_time_max_days"))),
	CONSTRAINT "products_stock_requires_sku" CHECK ("products"."stock_available" = 0 OR "products"."ozon_sku" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "products_ozon_product_id_idx" ON "products" USING btree ("ozon_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_ozon_offer_id_idx" ON "products" USING btree ("ozon_offer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_ozon_sku_idx" ON "products" USING btree ("ozon_sku");--> statement-breakpoint
CREATE INDEX "products_listing_idx" ON "products" USING btree ("status","category","sort_order");