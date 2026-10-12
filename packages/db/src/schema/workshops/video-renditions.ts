import { integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const videoRenditionStatus = pgEnum("video_rendition_status", [
  "processing", // воркер режет видео на куски
  "ready", // HLS готов, плеер показывает его вместо MP4
  "failed", // не вышло; воркер попробует ещё, пока не кончатся попытки
]);

/**
 * HLS-версия видео урока: исходный MP4, нарезанный на короткие куски. Куски
 * отдаются по одному через сайт, поэтому одним файлом урок не скачать.
 *
 * Ключ — videoKey исходника: у каждой загрузки свой ключ, так что замена
 * видео в админке сама требует новой нарезки, а форма курса эту таблицу не
 * трогает.
 */
export const videoRenditions = pgTable("video_renditions", {
  videoKey: text("video_key").primaryKey(),
  status: videoRenditionStatus("status").notNull(),
  // Папка в закрытом бакете: index.m3u8, init.mp4 и куски seg-NNNNN.m4s
  hlsPrefix: text("hls_prefix").notNull(),
  durationSeconds: integer("duration_seconds"),
  attempts: integer("attempts").notNull().default(0),
  // До этого времени видео занято воркером (или ждёт повтора после ошибки)
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type VideoRenditionRow = typeof videoRenditions.$inferSelect;
