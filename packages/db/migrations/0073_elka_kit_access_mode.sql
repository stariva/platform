CREATE TYPE "public"."kit_access_mode" AS ENUM('single_lesson', 'separate_gifts');--> statement-breakpoint
ALTER TABLE "product_orders" ADD COLUMN "kit_access_mode" "kit_access_mode";