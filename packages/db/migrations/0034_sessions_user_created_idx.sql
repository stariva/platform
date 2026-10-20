-- migrate:non-transactional
-- Сбой CONCURRENTLY может оставить невалидный индекс: пересоздаём при повторе.
DROP INDEX CONCURRENTLY IF EXISTS "sessions_user_created_idx";--> statement-breakpoint
CREATE INDEX CONCURRENTLY "sessions_user_created_idx" ON "sessions" USING btree ("user_id","created_at");
