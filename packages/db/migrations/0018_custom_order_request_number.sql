-- Человекочитаемый номер заявки. Уже сохранённые заявки нумеруем по дате
-- (с 1001), новые продолжают счёт с последнего номера.
ALTER TABLE "custom_order_requests" ADD COLUMN "number" integer;--> statement-breakpoint
UPDATE "custom_order_requests" AS r
SET "number" = n.rn + 1000
FROM (
	SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS rn
	FROM "custom_order_requests"
) AS n
WHERE r."id" = n."id";--> statement-breakpoint
ALTER TABLE "custom_order_requests" ALTER COLUMN "number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_order_requests" ALTER COLUMN "number" ADD GENERATED ALWAYS AS IDENTITY (sequence name "custom_order_requests_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1001 CACHE 1);--> statement-breakpoint
SELECT setval('"custom_order_requests_number_seq"', coalesce(max("number"), 1000) + 1, false) FROM "custom_order_requests";--> statement-breakpoint
CREATE UNIQUE INDEX "custom_order_requests_number_idx" ON "custom_order_requests" USING btree ("number");
