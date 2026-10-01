CREATE TYPE "public"."workshop_category" AS ENUM('lampshades', 'clothing', 'interior');--> statement-breakpoint
CREATE TYPE "public"."workshop_level" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."workshop_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "workshops" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" "workshop_category" NOT NULL,
	"level" "workshop_level" DEFAULT 'beginner' NOT NULL,
	"status" "workshop_status" DEFAULT 'draft' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"cover" text DEFAULT '' NOT NULL,
	"preview_image" text DEFAULT '' NOT NULL,
	"what_you_learn" text[] DEFAULT '{}'::text[] NOT NULL,
	"materials" text[] DEFAULT '{}'::text[] NOT NULL,
	"lessons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"material_files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ozon_url" text,
	"testimonial_text" text,
	"testimonial_author" text,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workshops_price_non_negative" CHECK ("workshops"."price" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workshops_slug_idx" ON "workshops" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "workshops_listing_idx" ON "workshops" USING btree ("status","category","sort_order");--> statement-breakpoint
-- Курс, который раньше лежал в apps/web/src/lib/workshops-data.ts. id урока и
-- ключ видео те же, что были: на них ссылаются lesson_progress и бакет.
INSERT INTO "workshops" (
	"id", "slug", "title", "subtitle", "description", "category", "level", "status",
	"price", "cover", "preview_image", "what_you_learn", "materials", "lessons", "featured"
) VALUES (
	'poyas-makrame-serdce',
	'poyas-makrame-serdce',
	'Пояс макраме «Сердце»',
	'Бесплатный мастер-класс: плетёный пояс с узором-сердцем',
	'Бесплатный мастер-класс для знакомства с макраме: сплетите изящный пояс с узором-сердцем в одном видеоуроке. Идеальный первый проект, чтобы попробовать технику перед покупкой полного курса.',
	'clothing',
	'beginner',
	'published',
	0,
	'/images/workshops/cover-poyas-serdce.jpg',
	'/images/workshops/preview-poyas-serdce.jpg',
	ARRAY['Базовые узлы макраме для пояса', 'Плетение узора-сердца', 'Равномерное натяжение нити', 'Финишная обработка концов и завязки'],
	ARRAY['Хлопковый шнур 3 мм — 15 м', 'Кольцо или пряжка для пояса', 'Ножницы', 'Расчёска для бахромы'],
	'[{"id": "poyas-makrame-serdce-1", "title": "Плетение пояса «Сердце»", "durationSeconds": 960, "videoKey": "workshops/poyas-makrame-serdce/poyas-makrame-serdce-1.mp4", "free": true}]'::jsonb,
	true
) ON CONFLICT ("slug") DO NOTHING;
