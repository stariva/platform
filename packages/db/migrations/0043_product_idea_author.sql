ALTER TABLE "products" ADD COLUMN "idea_author" text;--> statement-breakpoint
UPDATE "products" SET "idea_author" = 'Марина Камбур' WHERE "name" ILIKE 'Гном %';
