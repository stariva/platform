-- migrate:non-transactional
-- Индекс на живой таблице: CONCURRENTLY, чтобы запись журнала писем не ждала.
-- Сбой CONCURRENTLY может оставить невалидный индекс: пересоздаём при повторе.
DROP INDEX CONCURRENTLY IF EXISTS "email_log_idempotency_key_idx";--> statement-breakpoint
CREATE INDEX CONCURRENTLY "email_log_idempotency_key_idx" ON "email_log" USING btree ("idempotency_key");
