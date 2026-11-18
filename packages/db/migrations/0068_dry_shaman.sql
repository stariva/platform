ALTER TABLE "product_orders" ALTER COLUMN "preferred_contact_channel" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."product_contact_channel";--> statement-breakpoint
CREATE TYPE "public"."product_contact_channel" AS ENUM('telegram', 'whatsapp', 'max', 'email');--> statement-breakpoint
ALTER TABLE "product_orders" ALTER COLUMN "preferred_contact_channel" SET DATA TYPE "public"."product_contact_channel" USING "preferred_contact_channel"::"public"."product_contact_channel";