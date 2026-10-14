-- Подкатегория «Ёлки» и тексты витрины у товара. Новое значение enum можно
-- использовать только после коммита, поэтому данные ёлок — в 0026.
-- crm_sales.campaign_id/request_number уже созданы в 0023 (снимок 0023 их не
-- знал), здесь их нет.
ALTER TYPE "public"."product_subcategory" ADD VALUE 'trees';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "best_for" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "highlights" text[] DEFAULT '{}'::text[] NOT NULL;
