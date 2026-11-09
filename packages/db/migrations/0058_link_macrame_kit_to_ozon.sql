-- Привязка набора «Ёлка макраме» к карточке Ozon (создан в админке со slug nabor-makrame-elka).
-- Остаток не трогаем: его выставляют в админке, после чего он уходит на склад Ozon.
-- Если товара с таким slug нет (например, чистая база), миграция ничего не делает.
UPDATE "products"
SET
	"ozon_product_id" = 6912818632,
	"ozon_offer_id" = 'ELKA_KIT_001',
	"ozon_sku" = 6289493274
WHERE "slug" = 'nabor-makrame-elka'
	AND "ozon_product_id" IS NULL
	AND "ozon_offer_id" IS NULL
	AND "ozon_sku" IS NULL;
