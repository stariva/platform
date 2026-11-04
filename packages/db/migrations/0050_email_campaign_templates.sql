-- Временное значение по умолчанию: если до миграции успели завести рассылку,
-- обязательная колонка всё равно добавится. Затем default снимается, как в схеме.
ALTER TABLE "email_campaigns" ADD COLUMN "template" text DEFAULT 'telegram-invite' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_campaigns" ALTER COLUMN "template" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD COLUMN "params" jsonb DEFAULT '{}'::jsonb NOT NULL;
