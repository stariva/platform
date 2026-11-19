ALTER TABLE "products" ADD COLUMN "sell_on_ozon" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Набор «Ёлка макраме» продаём и на маркетплейсе Ozon. Без карточки Ozon
-- (привязка из 0058 могла не пройти) флаг не ставим: показывать нечего.
UPDATE "products"
SET "sell_on_ozon" = true
WHERE "slug" = 'nabor-makrame-elka' AND "ozon_sku" IS NOT NULL;
