CREATE TYPE "public"."video_rendition_status" AS ENUM('processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "video_renditions" (
	"video_key" text PRIMARY KEY NOT NULL,
	"status" "video_rendition_status" NOT NULL,
	"hls_prefix" text NOT NULL,
	"duration_seconds" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
