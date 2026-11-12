ALTER TABLE "products" ADD COLUMN "workshop_slug" text;--> statement-breakpoint
-- С набором «Ёлка макраме» идёт мастер-класс по маленькой ёлке. Нет такого
-- мастер-класса — связь не ставим: её можно выбрать в карточке товара.
UPDATE "products"
SET "workshop_slug" = 'elka-makrame'
WHERE "slug" = 'nabor-makrame-elka'
	AND EXISTS (SELECT 1 FROM "workshops" WHERE "slug" = 'elka-makrame');
