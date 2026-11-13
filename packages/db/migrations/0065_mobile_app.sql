CREATE TABLE "app_releases" (
	"version" text PRIMARY KEY NOT NULL,
	"bundle_zip_url" text NOT NULL,
	"min_native_version" text DEFAULT '1.0.0' NOT NULL,
	"apk_download_url" text,
	"release_notes" text DEFAULT '' NOT NULL,
	"build_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD COLUMN "checked_materials" text[] DEFAULT '{}'::text[] NOT NULL;