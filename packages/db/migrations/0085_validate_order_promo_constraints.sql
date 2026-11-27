-- migrate:non-transactional
ALTER TABLE "product_orders" VALIDATE CONSTRAINT "product_orders_promo_code_id_promo_codes_id_fk";--> statement-breakpoint
ALTER TABLE "product_orders" VALIDATE CONSTRAINT "product_orders_discount_range";
