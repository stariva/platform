CREATE TYPE "public"."product_contact_channel" AS ENUM('telegram', 'whatsapp', 'max', 'phone');--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "preferred_contact_channel" "product_contact_channel";--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "contact_messenger" text;