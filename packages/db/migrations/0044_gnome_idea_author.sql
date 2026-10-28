-- 0043 искала названия «Гном …», но на витрине они «Интерьерный вязаный гном …»
UPDATE "products" SET "idea_author" = 'Марина Камбур' WHERE "name" ILIKE '%гном%' AND "idea_author" IS NULL;
