import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
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
  /** Идентификатор письма у провайдера, если он его вернул. */
  messageId?: string;
  ms: number;
}

/**
 * Журнал исходящих писем: кому, с какой темой, чем кончилась отправка и какой
 * провайдер доставил. У Yandex Postbox своего журнала нет, поэтому ведём его
 * сами. HTML письма хранится, чтобы в админке видеть, что получил адресат. В
 * нём бывают коды входа и личные ссылки, так что доступ к журналу — только у
 * админов.
 *
 * Статус «sent» значит, что провайдер принял письмо, а не что оно лежит в
 * ящике: доставку и отказ сообщает Postbox событиями (delivered_at,
 * bounced_at), открытие — пиксель на сайте. Записи старше года можно удалять.
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
    // HTML письма, как его получил адресат. Пусто у записей до появления колонки
    // и когда письмо не отрисовалось
    html: text("html"),
    // Идентификатор письма в Postbox (ответ SendEmail): по нему события
    // доставки из Data Streams находят свою строку. У Resend и песочницы пусто
    messageId: text("message_id"),
    // Что Postbox сообщил о доставке (email_events): почтовый сервер
    // получателя принял письмо, отложил его, отказал или на письмо пожаловались
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    delayedAt: timestamp("delayed_at", { withTimezone: true }),
    bouncedAt: timestamp("bounced_at", { withTimezone: true }),
    // Permanent — ящика нет, Transient — временный сбой, Undetermined — неясно
    bounceType: text("bounce_type"),
    // Ответ почтового сервера получателя, почему не принял
    bounceDetail: text("bounce_detail"),
    complainedAt: timestamp("complained_at", { withTimezone: true }),
    // Токен пикселя открытия (/api/m/o/<токен>). У рассылки это токен
    // получателя: пиксель в письме один, открытие засчитывается и там, и тут.
    // Повторные попытки одного письма рассылки дают строки с тем же токеном
    openToken: text("open_token"),
    // Почтовик подгрузил картинку-пиксель. Это «скорее всего, открыли»:
    // Apple Mail и антивирусы грузят картинки сами, а с выключенными
    // картинками открытие не видно
    firstOpenedAt: timestamp("first_opened_at", { withTimezone: true }),
    openCount: integer("open_count").notNull().default(0),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("email_log_created_idx").on(table.createdAt),
    index("email_log_status_created_idx").on(table.status, table.createdAt),
    index("email_log_workshop_order_idx").on(table.workshopOrderId),
    uniqueIndex("email_log_message_id_uq").on(table.messageId),
    index("email_log_open_token_idx").on(table.openToken),
  ],
);

export type EmailLogRow = typeof emailLog.$inferSelect;
