import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "../auth/user";

/**
 * Журнал выдачи ссылок на видео уроков: кто, когда и откуда смотрел.
 * По нему видно, что одним аккаунтом пользуются с разных адресов, и ограничивается
 * частота запросов. Записи старше года можно удалять.
 */
export const videoAccessLog = pgTable(
  "video_access_log",
  {
    id: text("id").primaryKey(),
    // null — бесплатный урок-превью без входа. Удалили аккаунт — запись обезличена.
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    workshopSlug: text("workshop_slug").notNull(),
    lessonId: text("lesson_id").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("video_access_log_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("video_access_log_ip_created_idx").on(table.ip, table.createdAt),
  ],
);
