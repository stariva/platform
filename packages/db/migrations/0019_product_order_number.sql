-- migrate:non-transactional
-- Человекочитаемый номер заказа. Уже сохранённые заказы нумеруем по дате
-- (с 1001), новые продолжают счёт с последнего номера.
-- Отдельные коммиты пакетов и CONCURRENTLY требуют запуска через db:migrate.
ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "number" integer;--> statement-breakpoint
DO $$
DECLARE
	last_number integer;
	updated_count integer;
BEGIN
	-- GENERATED ALWAYS запрещает UPDATE даже без подходящих строк.
	IF NOT EXISTS (SELECT 1 FROM "product_orders" WHERE "number" IS NULL) THEN
		RETURN;
	END IF;
	SELECT coalesce(max("number"), 1000) INTO last_number FROM "product_orders";
	LOOP
		WITH batch AS (
			SELECT "id", "created_at"
			FROM "product_orders"
			WHERE "number" IS NULL
			ORDER BY "created_at", "id"
			LIMIT 1000
		), numbered AS (
			SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS rn
			FROM batch
		), updated AS (
			UPDATE "product_orders" AS o
			SET "number" = last_number + n.rn
			FROM numbered AS n
			WHERE o."id" = n."id"
			RETURNING o."number"
		)
		SELECT count(*), coalesce(max("number"), last_number)
		INTO updated_count, last_number FROM updated;
		COMMIT;
		EXIT WHEN updated_count = 0;
	END LOOP;
END $$;--> statement-breakpoint
DO $$
BEGIN
	-- Не допускаем вставку NULL между проверкой и установкой identity.
	LOCK TABLE "product_orders" IN ACCESS EXCLUSIVE MODE;
	IF EXISTS (SELECT 1 FROM "product_orders" WHERE "number" IS NULL) THEN
		RAISE EXCEPTION 'product_orders.number still contains NULL; rerun db:migrate';
	END IF;
	ALTER TABLE "product_orders" ALTER COLUMN "number" SET NOT NULL;
	-- При повторном запуске после сбоя индекса сохраняем действующий счётчик.
	IF NOT EXISTS (
		SELECT 1 FROM pg_attribute
		WHERE attrelid = 'product_orders'::regclass AND attname = 'number' AND attidentity <> ''
	) THEN
		ALTER TABLE "product_orders" ALTER COLUMN "number" ADD GENERATED ALWAYS AS IDENTITY (sequence name "product_orders_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1001 CACHE 1);
		PERFORM setval('"product_orders_number_seq"', coalesce(max("number"), 1000) + 1, false) FROM "product_orders";
	END IF;
END $$;--> statement-breakpoint
-- Сбой CONCURRENTLY может оставить невалидный индекс: пересоздаём при повторе.
DROP INDEX CONCURRENTLY IF EXISTS "product_orders_number_idx";--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "product_orders_number_idx" ON "product_orders" USING btree ("number");
