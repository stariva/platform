import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { user } from "./auth/user";

export const EMAIL_CAMPAIGN_STATUSES = ["draft", "sending", "sent"] as const;
export type EmailCampaignStatus = (typeof EMAIL_CAMPAIGN_STATUSES)[number];

// skipped — адрес успел отписаться между запуском рассылки и отправкой
export const EMAIL_RECIPIENT_STATUSES = [
  "queued",
  "sent",
  "failed",
  "skipped",
] as const;
export type EmailRecipientStatus = (typeof EMAIL_RECIPIENT_STATUSES)[number];

export const EMAIL_SUPPRESSION_REASONS = [
  "unsubscribed",
  "bounced",
  "complained",
] as const;
export type EmailSuppressionReason = (typeof EMAIL_SUPPRESSION_REASONS)[number];

/**
 * Кому уходит рассылка. Пока один вид — покупатели мастер-классов: по
 * оплаченным заказам, пустой список курсов — все курсы.
 */
export type EmailCampaignSegment = {
  type: "workshop_buyers";
  workshops: string[];
};

/**
 * Рассылка из админки: письмо (тема, заголовок, текст, кнопка) и кому его
 * слать. Список получателей фиксируется при запуске в
 * email_campaign_recipients, после запуска письмо не меняется.
 */
export const emailCampaigns = pgTable("email_campaigns", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // Название для админки, адресат его не видит
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  // Строка-превью рядом с темой во «Входящих»
  previewText: text("preview_text").notNull().default(""),
  heading: text("heading").notNull(),
  // Простой текст; пустая строка разделяет абзацы
  body: text("body").notNull(),
  buttonLabel: text("button_label"),
  buttonUrl: text("button_url"),
  segment: jsonb("segment").$type<EmailCampaignSegment>().notNull(),
  status: text("status", { enum: EMAIL_CAMPAIGN_STATUSES })
    .notNull()
    .default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

/**
 * Получатель рассылки и всё, что о нём известно: ушло ли письмо, открыл ли
 * (по картинке-пикселю — с запасом: почтовики сами подгружают картинки),
 * перешёл ли по кнопке, отписался ли. Токен — в ссылках письма вместо
 * адреса, по нему сайт находит получателя.
 *
 * Незавершённую отправку можно повторить после leaseUntil: так письма
 * дошлёт крон, если отправку из админки прервали.
 */
export const emailCampaignRecipients = pgTable(
  "email_campaign_recipients",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => emailCampaigns.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    token: text("token").notNull().unique(),
    status: text("status", { enum: EMAIL_RECIPIENT_STATUSES })
      .notNull()
      .default("queued"),
    // Ответ провайдера, если письмо не ушло
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    firstOpenedAt: timestamp("first_opened_at", { withTimezone: true }),
    openCount: integer("open_count").notNull().default(0),
    firstClickedAt: timestamp("first_clicked_at", { withTimezone: true }),
    clickCount: integer("click_count").notNull().default(0),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("email_campaign_recipients_uq").on(t.campaignId, t.email),
    index("email_campaign_recipients_status_idx").on(t.status, t.leaseUntil),
  ],
);

/**
 * Адреса, которым рассылки не шлём: отписались, ящик не существует или
 * пожаловались на спам. Адрес в нижнем регистре. Служебные письма (заказы,
 * коды входа) сюда не смотрят.
 */
export const emailSuppressions = pgTable("email_suppressions", {
  email: text("email").primaryKey(),
  reason: text("reason", { enum: EMAIL_SUPPRESSION_REASONS }).notNull(),
  // Из какой рассылки отписались
  campaignId: text("campaign_id").references(() => emailCampaigns.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type EmailCampaignRow = typeof emailCampaigns.$inferSelect;
export type EmailCampaignRecipientRow =
  typeof emailCampaignRecipients.$inferSelect;
