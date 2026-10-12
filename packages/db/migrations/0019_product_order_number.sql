-- Человекочитаемый номер заказа. Уже сохранённые заказы нумеруем по дате
-- (с 1001), новые продолжают счёт с последнего номера.
ALTER TABLE "product_orders" ADD COLUMN "number" integer;--> statement-breakpoint
UPDATE "product_orders" AS o
SET "number" = n.rn + 1000
FROM (
	SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS rn
	FROM "product_orders"
) AS n
WHERE o."id" = n."id";--> statement-breakpoint
ALTER TABLE "product_orders" ALTER COLUMN "number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "product_orders" ALTER COLUMN "number" ADD GENERATED ALWAYS AS IDENTITY (sequence name "product_orders_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1001 CACHE 1);--> statement-breakpoint
SELECT setval('"product_orders_number_seq"', coalesce(max("number"), 1000) + 1, false) FROM "product_orders";--> statement-breakpoint
CREATE UNIQUE INDEX "product_orders_number_idx" ON "product_orders" USING btree ("number");
