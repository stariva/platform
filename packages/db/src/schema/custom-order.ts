import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Durable inbox/outbox; no public read API. */
export const customOrderRequests = pgTable(
  "custom_order_requests",
  {
    id: text("id").primaryKey(),
    // Номер, который видят покупатель и мастер: «Заявка №1042».
    // id остаётся ключом идемпотентности формы.
    number: integer("number")
      .generatedAlwaysAsIdentity({ startWith: 1001 })
      .notNull(),
    fingerprint: text("fingerprint").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    message: text("message").notNull(),
    photoBase64: text("photo_base64"),
    photoType: text("photo_type"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("custom_order_requests_number_idx").on(table.number),
    index("custom_order_retry_idx").on(table.deliveredAt, table.nextAttemptAt),
  ],
);
