-- Привязка набора «Ёлка макраме» к карточке Ozon (создан в админке со slug nabor-makrame-elka).
-- Остаток не трогаем: его выставляют в админке, после чего он уходит на склад Ozon.
-- Миграция никогда не падает и не перезаписывает чужие данные: при любой неясности
-- она пропускает привязку и пишет WARNING, который виден в логе деплоя.
DO $$
DECLARE
	kit_id text;
	kit_product bigint;
	kit_offer text;
	kit_sku bigint;
BEGIN
	SELECT "id", "ozon_product_id", "ozon_offer_id", "ozon_sku"
	INTO kit_id, kit_product, kit_offer, kit_sku
	FROM "products"
	WHERE "slug" = 'nabor-makrame-elka';

	IF kit_id IS NULL THEN
		RAISE NOTICE 'Ozon link skipped: product nabor-makrame-elka not found';
		RETURN;
	END IF;

	-- Уже заполненные поля должны совпадать с нужными значениями, иначе не трогаем товар.
	IF (kit_product IS NOT NULL AND kit_product <> 6912818632)
		OR (kit_offer IS NOT NULL AND kit_offer <> 'ELKA_KIT_001')
		OR (kit_sku IS NOT NULL AND kit_sku <> 6289493274) THEN
		RAISE WARNING 'Ozon link skipped: product nabor-makrame-elka already has different Ozon ids, check manually';
		RETURN;
	END IF;

	-- Уникальные индексы: если идентификаторы заняты другим товаром, его не меняем.
	IF EXISTS (
		SELECT 1 FROM "products"
		WHERE "id" <> kit_id
			AND ("ozon_product_id" = 6912818632 OR "ozon_offer_id" = 'ELKA_KIT_001')
	) THEN
		RAISE WARNING 'Ozon link skipped: Ozon product id or offer id is already used by another product, check manually';
		RETURN;
	END IF;

	UPDATE "products"
	SET
		"ozon_product_id" = 6912818632,
		"ozon_offer_id" = 'ELKA_KIT_001',
		"ozon_sku" = 6289493274
	WHERE "id" = kit_id;
END $$;
