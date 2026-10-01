-- Новый источник отзывов — Авито. ALTER TYPE ... ADD VALUE не годится: drizzle
-- катит миграции одной транзакцией, а новое значение enum нельзя использовать
-- до коммита, — поэтому тип пересоздаём.
ALTER TYPE "public"."review_source" RENAME TO "review_source_old";--> statement-breakpoint
CREATE TYPE "public"."review_source" AS ENUM('ozon', 'avito', 'site');--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "source" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "source" SET DATA TYPE "public"."review_source" USING "source"::text::"public"."review_source";--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "source" SET DEFAULT 'ozon';--> statement-breakpoint
DROP TYPE "public"."review_source_old";--> statement-breakpoint
CREATE TABLE "review_products" (
	"review_id" text NOT NULL,
	"product_id" text NOT NULL,
	CONSTRAINT "review_products_review_id_product_id_pk" PRIMARY KEY("review_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "review_products" ADD CONSTRAINT "review_products_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_products" ADD CONSTRAINT "review_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_products_product_id_idx" ON "review_products" USING btree ("product_id");--> statement-breakpoint
-- Отзывы с Ozon до сих пор попадали на карточку по артикулу — переносим эти
-- связи как есть.
INSERT INTO "review_products" ("review_id", "product_id")
SELECT r."id", p."id"
FROM "reviews" r
JOIN "products" p ON p."ozon_offer_id" = r."product_offer_id";--> statement-breakpoint
-- Отзывы из профиля на Авито (скриншоты от 2026-10-01). Текст — как написал
-- покупатель; без года Авито показывает даты текущего, 2026 года. Фото пока
-- не переносим: со скриншотов только превью с водяным знаком. «Сделка
-- сорвалась» у отзыва Марии от 20.08.2025 — он заведён скрытым, решение в
-- админке.
INSERT INTO "reviews" (
	"id", "source", "rating", "text", "reviewer_name", "product_title",
	"reviewed_at", "published"
) VALUES
	('avito-20230422-olga', 'avito', 5, 'Спасибо продавцу за эту сумочку!Работа прекрасная,сумочка очень милая,качественная,держит прекрасно форму,аккуратная, я бы сказала безупречная.Пришла в коробке,аккуратно запакованной.Общение с Ольгой было приятным, оперативным.Буду обращаться ещё.', 'Ольга И.', 'Сумочка из шнура', '2023-04-22T09:00:00Z', true),
	('avito-20230715-irina', 'avito', 5, 'Осумочку получила. Отправлена быстро. Продавец приятный в общении. Товар понравился, связано качественно. Спасибо.', 'Ирина Д.', 'Сумочка из хлопкового шнура', '2023-07-15T09:00:00Z', true),
	('avito-20240119-tatyana', 'avito', 5, 'Безупречная работа !!!!!!Я в восторге 😍', 'Татьяна', 'Платье туника макраме', '2024-01-19T09:00:00Z', true),
	('avito-20240223-olga', 'avito', 5, 'Заказывала платье через авито доставку, отправка была оперативная, все пришло даже раньше, чем я ожидала. Вчера забрала платье, оно прекрасно, цвет как на фото и прям как я хотела, нити натуральные. Благодарю вас 🌺🥰', 'Ольга', 'Платье туника макраме', '2024-02-23T09:00:00Z', true),
	('avito-20240303-evgeniya', 'avito', 5, 'Все отлично! Получила на днях уже второй набор салфеток (с детьми приходится часто их стирать). Качество отличное и внешний вид прекрасный! Большое спасибо!!!', 'Евгения Ф.', 'Набор для сервировки', '2024-03-03T09:00:00Z', true),
	('avito-20240911-tvoy-personazh', 'avito', 5, 'Отличный жакет в стиле Бохо! Очень понравился.', 'Студия проката костюмов «Твой персонаж»', 'Жакет макраме, туника, бохо', '2024-09-11T09:00:00Z', true),
	('avito-20241129-mariya', 'avito', 5, 'Прекрасная работа, второй год мечтала о елочке-макраме и просто случайно увидела ее у Ольги.  Оля сплела и отправила ее мне за два дня!!!
Теперь над моим рабочим столом красиво 😍', 'Мария', 'Новогодние украшения', '2024-11-29T09:00:00Z', true),
	('avito-20241203-olga', 'avito', 5, 'Получила ёлочку. Чудесная ручная работа! Быстро договорились, быстрая авито-доставка.
Благодарю!', 'Ольга', 'Панно новогоднее, ёлка макраме', '2024-12-03T09:00:00Z', true),
	('avito-20241208-kristina', 'avito', 5, 'Спасибо! Помогли реализовать нашу смелую задумку! Качество исполнения 🔝очень рада, что выбрала вас. В процессе работы все обсуждалось, фото присылали. Опаковали так бережно, сделали быстро, я довольна 👍', 'Кристина Г.', 'Люстра, абажур макраме, лофт', '2024-12-08T09:00:00Z', true),
	('avito-20241218-aleksey', 'avito', 5, 'Всё просто супер. Супруга ооочень довольна. Елочка просто супер. За доп игрушки отдельное спасибо. 🙏🙏🙏🔥', 'Алексей', 'Панно новогоднее, ёлка макраме', '2024-12-18T09:00:00Z', true),
	('avito-20250721-anastasiya', 'avito', 5, 'Ольга невероятно талантливая девушка,,сделала для меня потрясающую красивую люстру', 'Анастасия', 'Декор макраме, фонарик, абажур, светильник', '2025-07-21T09:00:00Z', true),
	('avito-20250820-mariya', 'avito', 5, 'Заботливо упаковано все, сразу отправлено)) удовольствие покупать у этого продавца)
Спасибо', 'Мария', 'Сумочка из шнура с мешочком', '2025-08-20T09:00:00Z', false),
	('avito-20251214-sandra', 'avito', 5, 'Елочка очень понравилась, сплетено аккуратно,отправили быстро. Рекомендую!', 'Сандра', 'Панно новогоднее, ёлка макраме', '2025-12-14T09:00:00Z', true),
	('avito-20251220-alena', 'avito', 5, 'Очень красивая 🫶 отлично вписалась в интерьер!', 'Алена', 'Панно новогоднее, ёлка макраме', '2025-12-20T09:00:00Z', true),
	('avito-20260104-ekaterina', 'avito', 5, 'Спасибо за елочку.', 'Екатерина', 'Панно новогоднее, ёлка макраме', '2026-01-04T09:00:00Z', true),
	('avito-20260111-marina', 'avito', 5, 'Заказывала елочку перед Новым годом. Думала не успею получить. Но нет. Все быстро связали, быстро привезли через доставку. Елочка 🌲 великолепная, прям как я хотела. Спасибо огромное!', 'Марина', 'Панно новогоднее, ёлка макраме', '2026-01-11T09:00:00Z', true),
	('avito-20260524-anzhelika', 'avito', 5, 'Это что-то волшебное и бесподобное. Спасибо за шикарное изделие ❤️❤️❤️', 'Анжелика', 'Пояс макраме с бахромой, бохо, баска', '2026-05-24T09:00:00Z', true),
	('avito-20260604-karina', 'avito', 5, 'Прекрасное изделие, приятная девушка', 'Карина', 'Пояс Сердце макраме с бахромой, бохо, баска', '2026-06-04T09:00:00Z', true),
	('avito-20260625-elizaveta', 'avito', 5, 'Превзошел ожидания !!!
Очень красивый
Фото для примера, с подходящей одеждой - изумительно
Спасибо мастеру ❤️❤️‍🔥🔥', 'Елизавета', 'Пояс Сердце макраме с бахромой, бохо, баска', '2026-06-25T09:00:00Z', true)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
-- Объявление на Авито — модель во всех цветах, поэтому отзыв о ёлке виден на
-- обеих её карточках. Неясные отзывы (какая туника, какой абажур) пока без
-- товара — они показываются в общих блоках, привязать можно в админке.
INSERT INTO "review_products" ("review_id", "product_id")
SELECT link."review_id", p."id"
FROM (VALUES
	('avito-20240303-evgeniya', 'PLATE-001'),
	('avito-20240911-tvoy-personazh', 'PLT-MACR-011'),
	('avito-20241203-olga', 'ELKA_001'),
	('avito-20241203-olga', 'ELKA_002'),
	('avito-20241218-aleksey', 'ELKA_001'),
	('avito-20241218-aleksey', 'ELKA_002'),
	('avito-20251214-sandra', 'ELKA_001'),
	('avito-20251214-sandra', 'ELKA_002'),
	('avito-20251220-alena', 'ELKA_001'),
	('avito-20251220-alena', 'ELKA_002'),
	('avito-20260104-ekaterina', 'ELKA_001'),
	('avito-20260104-ekaterina', 'ELKA_002'),
	('avito-20260111-marina', 'ELKA_001'),
	('avito-20260111-marina', 'ELKA_002'),
	('avito-20260604-karina', 'BELT_004'),
	('avito-20260625-elizaveta', 'BELT_004')
) AS link ("review_id", "offer_id")
JOIN "products" p ON p."ozon_offer_id" = link."offer_id"
ON CONFLICT DO NOTHING;
