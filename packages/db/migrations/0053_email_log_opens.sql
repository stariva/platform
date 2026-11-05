-- migrate:non-transactional
-- Индекс на живой таблице: CONCURRENTLY, чтобы запись журнала писем не ждала.
-- Шаги можно повторить после сбоя.
ALTER TABLE "email_log" ADD COLUMN IF NOT EXISTS "open_token" text;--> statement-breakpoint
ALTER TABLE "email_log" ADD COLUMN IF NOT EXISTS "first_opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_log" ADD COLUMN IF NOT EXISTS "open_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Письма рассылок, ушедшие до этой миграции: токен получателя связывает их с
-- рассылкой, и админка покажет доставку.
UPDATE "email_log" l SET "open_token" = r."token"
FROM "email_campaign_recipients" r
WHERE l."open_token" IS NULL
  AND l."idempotency_key" = 'campaign:' || r."campaign_id" || ':' || r."id";--> statement-breakpoint
-- Сбой CONCURRENTLY может оставить невалидный индекс: пересоздаём при повторе.
DROP INDEX CONCURRENTLY IF EXISTS "email_log_open_token_idx";--> statement-breakpoint
CREATE INDEX CONCURRENTLY "email_log_open_token_idx" ON "email_log" USING btree ("open_token");
