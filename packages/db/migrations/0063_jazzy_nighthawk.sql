ALTER TABLE "product_order_items" ADD COLUMN "workshop_slug" text;--> statement-breakpoint
ALTER TABLE "product_order_items" ADD COLUMN "workshop_link_captured" boolean DEFAULT false NOT NULL;