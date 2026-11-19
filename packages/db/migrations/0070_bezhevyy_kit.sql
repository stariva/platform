-- Бежевый набор «Ёлка макраме» — второй цвет набора nabor-makrame-elka
-- (тёплый оливковый). Тексты и цена те же, фото бежевого набора уже в CDN:
-- products/14fc50f2-1eb2-4e55-8221-502fe8f25104/a5585dc9daa31985.png
-- Заводим миграцией, а не через админку: сразу вместе с артикулами Ozon и
-- остатком. Остаток в админке после этого лишь переподтверждают — он уйдёт
-- на FBS-склад Ozon.
-- Миграция никогда не падает и не перезаписывает чужие данные: если товар
-- уже существует или артикулы Ozon заняты другим товаром, она пропускает
-- вставку и пишет WARNING, который виден в логе деплоя.
DO $$
DECLARE
	kit_product bigint; -- id карточки Ozon
	kit_offer text; -- артикул (offer id), например ELKA_KIT_002
	kit_sku bigint; -- SKU для Ozon Доставки (FBS)
	kit_stock integer; -- сколько бежевых наборов готово
BEGIN
	-- Артикулов может не быть: тогда продаём без онлайн-покупки, остаток — ноль.
	-- Проверка products_stock_requires_sku не даст остаток без SKU.
	kit_stock := COALESCE(kit_stock, 0);
	IF kit_sku IS NULL THEN
		kit_stock := 0;
	END IF;

	IF EXISTS (SELECT 1 FROM "products" WHERE "slug" = 'nabor-makrame-elka-bezhevyy') THEN
		RAISE NOTICE 'Beige kit skipped: product nabor-makrame-elka-bezhevyy already exists';
		RETURN;
	END IF;

	IF kit_offer IS NOT NULL AND EXISTS (
		SELECT 1 FROM "products"
		WHERE (kit_product IS NOT NULL AND "ozon_product_id" = kit_product)
			OR "ozon_offer_id" = kit_offer
			OR (kit_sku IS NOT NULL AND "ozon_sku" = kit_sku)
	) THEN
		RAISE WARNING 'Beige kit skipped: Ozon product id %, offer id % or sku % is already used by another product. Free them, then insert manually: products.id = 14fc50f2-1eb2-4e55-8221-502fe8f25104, slug nabor-makrame-elka-bezhevyy.', kit_product, kit_offer, kit_sku;
		RETURN;
	END IF;

	INSERT INTO "products" (
		"id", "slug", "name", "description", "category", "subcategory",
		"status", "price", "old_price", "images", "material", "color",
		"dimensions", "made_to_order", "ozon_product_id", "ozon_offer_id",
		"ozon_sku", "stock_available", "sell_on_ozon", "highlights",
		"workshop_slug"
	) VALUES (
		'14fc50f2-1eb2-4e55-8221-502fe8f25104',
		'nabor-makrame-elka-bezhevyy',
		'Набор для макраме «Ёлка» бежевый с видеоуроком',
		$desc$<p>Сплетите настенную ёлку высотой больше метра за пару вечеров — даже если никогда не держали шнур в руках.</p>
<p>Искусственная ёлка занимает полкомнаты, собирает пыль и одиннадцать месяцев лежит в кладовке. Эта висит на стене или двери: 110 см в высоту, 50 см в ширину, тёплого бежевого цвета. Добавьте гирлянду на батарейках и деревянные игрушки — и в доме сразу Новый год. В наборе для плетения «Ёлка макраме» есть всё, чтобы сделать такой новогодний декор своими руками.</p>
<p><strong>Из маленькой коробки — ёлка больше метра</strong></p>
<p>Коробка размером 58×12×4 см, а ёлка из неё вырастает до 110 см. Готовая ёлка похожего размера, которую сплела я, стоит 3 500 ₽ — с набором вы сплетёте её сами.</p>
<p><strong>Почему получится с нуля</strong></p>
<p>В коробке лежит карточка с QR-кодом: он открывает мой видеоурок на 2 часа 20 минут. Ёлка строится на трёх базовых узлах, каждый я показываю крупным планом. Урок можно ставить на паузу и пересматривать — доступ остаётся навсегда. Если узел не выходит, напишите в чат участниц в Telegram: я подскажу, как поправить.</p>
<p><strong>Что в коробке</strong></p>
<ul><li>Хлопковый шнур 5 мм, 100 м, бежевый: мягкий, ложится в ровные узлы.</li><li>Деревянная палочка-основа.</li><li>Деревянные бусины и звезда на макушку.</li><li>Карточка с QR-кодом и кодом доступа к видеоуроку.</li></ul>
<p><strong>Что понадобится дома</strong></p>
<p>Ножницы, сантиметровая лента и малярный скотч. Больше ничего докупать не нужно.</p>
<p><strong>Подарок, который плетут сами</strong></p>
<p>Коробка небольшая и аккуратная — её удобно положить под ёлку маме, сестре, подруге или коллеге. Это подарок не на полку: уютный вечер за плетением и ёлка, про которую можно сказать «я сплела её сама».</p>$desc$,
		'interior',
		'kits',
		'published',
		198000,
		240000,
		ARRAY['https://cdn.stariva.ru/products/14fc50f2-1eb2-4e55-8221-502fe8f25104/a5585dc9daa31985.png']::text[],
		'Хлопок, дерево',
		'Тёплый бежевый',
		'Готовая ёлка 50×110 см; коробка 58×12×4 см',
		false,
		kit_product,
		kit_offer,
		kit_sku,
		kit_stock,
		kit_sku IS NOT NULL,
		ARRAY[
			'В коробке всё для плетения: 100 м хлопкового шнура 5 мм, деревянная основа, бусины и звезда',
			'Видеоурок 2 ч 20 мин: от первого узла до готовой ёлки, доступ навсегда',
			'Запутаетесь в узле — я подскажу в чате участниц в Telegram',
			'Ёлка 50×110 см висит на стене: не занимает пол и не осыпается',
			'Готовая ёлка похожего размера стоит 3 500 ₽ — с набором сплетёте её сами'
		]::text[],
		'elka-makrame'
	);
END $$;
