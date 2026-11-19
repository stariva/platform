-- Сначала добавляем шаблон и параметры, переносим в них ссылку кнопки, и
-- только потом (0050) удаляем колонки свободного текста. Если рассылку успели
-- отправить старой версией, переходы по кнопке из её писем продолжат вести
-- в канал, а HTML отправленных писем остаётся в email_log.
--
-- Временное значение по умолчанию нужно, чтобы обязательная колонка
-- добавилась и к уже заведённым рассылкам; затем default снимается, как в схеме.
ALTER TABLE "email_campaigns" ADD COLUMN "template" text DEFAULT 'telegram-invite' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_campaigns" ALTER COLUMN "template" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD COLUMN "params" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "email_campaigns" SET "params" = jsonb_build_object('channelUrl', "button_url") WHERE "button_url" IS NOT NULL;
