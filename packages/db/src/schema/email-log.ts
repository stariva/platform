import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const EMAIL_LOG_STATUSES = ["sent", "failed"] as const;
export type EmailLogStatus = (typeof EMAIL_LOG_STATUSES)[number];

/** Одна попытка отправки одним почтовым провайдером. */
export interface EmailAttempt {
  /** resend, postbox или sandbox (локальный SMTP-перехватчик). */
  provider: string;
  ok: boolean;
  /** Ответ провайдера как есть; у удачной попытки нет. */
  error?: string;
  ms: number;
}

/**
 * Журнал исходящих писем: кому, с какой темой, чем кончилась отправка и какой
 * провайдер доставил. У Yandex Postbox своего журнала нет, поэтому ведём его
 * сами. Тела письма здесь нет — в нём бывают коды входа и личные ссылки.
 *
 * Статус «sent» значит, что провайдер принял письмо, а не что оно лежит в
 * ящике: о недоставке (bounce) провайдеры сообщают отдельно. Записи старше
 * года можно удалять.
 */
export const emailLog = pgTable(
  "email_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Адреса через запятую: письмо почти всегда одному получателю
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    status: text("status", { enum: EMAIL_LOG_STATUSES }).notNull(),
    // Кто доставил; у недоставленного — последний, кого пробовали
    provider: text("provider"),
    // Все попытки по порядку: видно, что Resend отказал, а Postbox отправил
    attempts: jsonb("attempts").$type<EmailAttempt[]>().notNull(),
    // Ответ последнего провайдера, если письмо так и не ушло
    error: text("error"),
    attachments: integer("attachments").notNull().default(0),
    // Ключ идемпотентности письма сайта: workshop:<заказ>:<вид>:email
    idempotencyKey: text("idempotency_key"),
    // Заказ мастер-класса и вид письма, если их удалось вычислить из ключа
    workshopOrderId: text("workshop_order_id"),
    kind: text("kind"),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("email_log_created_idx").on(table.createdAt),
    index("email_log_status_created_idx").on(table.status, table.createdAt),
    index("email_log_workshop_order_idx").on(table.workshopOrderId),
  ],
);

export type EmailLogRow = typeof emailLog.$inferSelect;
