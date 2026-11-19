-- Привязка бежевого и шалфейного наборов «Ёлка макраме» к карточкам Ozon,
-- созданным через Seller API: ELKA_KIT_002 и ELKA_KIT_003. Остаток по 3 набора
-- выставлен и на FBS-складе Ozon, и на сайте — онлайн-покупка включается сразу.
-- По образцу 0058: миграция не падает и не перезаписывает чужие данные —
-- при конфликте артикулов пропускает товар и пишет WARNING в лог деплоя.
DO $$
DECLARE
	link record;
	kit_id text;
BEGIN
	FOR link IN
		SELECT *
		FROM (VALUES
			('nabor-makrame-elka-bezhevyy'::text, 7055271596::bigint, 'ELKA_KIT_002'::text, 6414084568::bigint),
			('nabor-makrame-elka-shalfey'::text, 7055294220::bigint, 'ELKA_KIT_003'::text, 6414090158::bigint)
		) AS v(slug, product_id, offer_id, sku)
	LOOP
		SELECT "id" INTO kit_id FROM "products" WHERE "slug" = link.slug;
		IF kit_id IS NULL THEN
			RAISE WARNING 'Ozon link skipped: product % not found', link.slug;
			CONTINUE;
		END IF;

		IF EXISTS (
			SELECT 1 FROM "products"
			WHERE "id" <> kit_id
				AND (
					"ozon_product_id" = link.product_id
					OR "ozon_offer_id" = link.offer_id
					OR "ozon_sku" = link.sku
				)
		) THEN
			RAISE WARNING 'Ozon link skipped: ids %, %, % are used by another product (slug %). Fix manually.', link.product_id, link.offer_id, link.sku, link.slug;
			CONTINUE;
		END IF;

		UPDATE "products"
		SET
			"ozon_product_id" = link.product_id,
			"ozon_offer_id" = link.offer_id,
			"ozon_sku" = link.sku,
			"stock_available" = 3,
			"sell_on_ozon" = true
		WHERE "id" = kit_id
			AND ("ozon_product_id" IS NULL OR "ozon_product_id" = link.product_id)
			AND ("ozon_offer_id" IS NULL OR "ozon_offer_id" = link.offer_id)
			AND ("ozon_sku" IS NULL OR "ozon_sku" = link.sku);

		IF NOT FOUND THEN
			RAISE WARNING 'Ozon link skipped: product % already has different Ozon ids, fix manually', link.slug;
		END IF;
	END LOOP;
END $$;
