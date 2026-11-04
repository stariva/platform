import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * События писем из Postbox: Delivery, Bounce, Complaint, DeliveryDelay и
 * прочие, как они пришли из потока Data Streams. Поток доставляет «хотя бы
 * раз», поэтому ключ — eventId Postbox: повтор просто не вставится.
 *
 * Событие может прийти раньше, чем строка email_log с тем же message_id
 * (журнал пишется после ответа Postbox), поэтому события лежат отдельно, а
 * итог по письму пересчитывается из них при каждом новом.
 */
export const emailEvents = pgTable(
  "email_events",
  {
    eventId: text("event_id").primaryKey(),
    messageId: text("message_id").notNull(),
    // eventType Postbox: Send, Delivery, Bounce, Complaint, DeliveryDelay…
    type: text("type").notNull(),
    // Адреса, к которым относится событие; у Send и Open их нет
    recipients: text("recipients").array().notNull().default([]),
    // Когда случилось по данным Postbox
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    // Событие целиком, без заголовков письма
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("email_events_message_idx").on(t.messageId, t.occurredAt),
    // Прогон каждую минуту пересчитывает письма с событиями за последний час
    index("email_events_created_idx").on(t.createdAt),
  ],
);

/**
 * Докуда прочитан поток событий Postbox: последний обработанный номер
 * записи в каждом шарде. Следующий прогон продолжает после него.
 */
export const emailStreamCursors = pgTable(
  "email_stream_cursors",
  {
    stream: text("stream").notNull(),
    shardId: text("shard_id").notNull(),
    sequenceNumber: text("sequence_number").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.stream, t.shardId] })],
);

export type EmailEventRow = typeof emailEvents.$inferSelect;
