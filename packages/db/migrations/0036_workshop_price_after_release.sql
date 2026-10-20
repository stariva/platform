ALTER TABLE "workshops" ADD COLUMN "price_after_release" integer;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_price_after_release_non_negative" CHECK ("workshops"."price_after_release" >= 0);--> statement-breakpoint
-- Цена после старта жила в коде сайта (lib/workshops/release-price.ts) — переносим в базу
UPDATE "workshops" SET "price_after_release" = 99000 WHERE "slug" IN ('elka-makrame', 'elka-makrame-bolshaya');
