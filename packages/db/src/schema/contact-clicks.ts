import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { CampaignAttribution } from "./attribution";
import { user } from "./auth/user";
import type { VisitorInfo } from "./visitor";

export const CONTACT_CHANNELS = [
  "telegram",
  "whatsapp",
  "max",
  "phone",
] as const;
export type ContactClickChannel = (typeof CONTACT_CHANNELS)[number];

/**
 * Откуда начался этот заход на сайт (вкладка браузера): страница входа,
 * сайт, с которого пришли, и метки из ссылки. В отличие от cookie с
 * UTM-атрибуцией, есть и у заходов без меток: из поиска, с соцсетей, напрямую.
 */
export interface SessionEntry {
  landing: string;
  // Только хост; нет — прямой заход или браузер не передал
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  // Метка клика Яндекс Директа и VK Рекламы: заход с объявления, даже без UTM
  yclid?: string;
  rb_clickid?: string;
  at: string; // ISO 8601
}

/**
 * Переходы с сайта в мессенджеры и звонки мастеру. Сам разговор идёт уже
 * в Telegram, WhatsApp или MAX, поэтому сайт знает только о клике по ссылке:
 * кто (аккаунт, IP, город, устройство), с какого блока и страницы и с какой
 * рекламы пришёл. По этим кликам админка сравнивает рекламу с расходами.
 *
 * browser_id — тот же случайный id браузера, что cart_id в журнале корзин:
 * по нему переход связывается с корзиной и заказом этого браузера.
 */
export const contactClicks = pgTable(
  "contact_clicks",
  {
    id: text("id").primaryKey(),
    browserId: text("browser_id"),
    // Если посетитель вошёл в кабинет. Удалили аккаунт — запись обезличена.
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    channel: text("channel", { enum: CONTACT_CHANNELS }).notNull(),
    // Блок, где стоит ссылка (data-location): footer, elka_hero, chat…
    source: text("source"),
    page: text("page"),
    entry: jsonb("entry").$type<SessionEntry>(),
    // Первый и последний заход по UTM за 90 дней (cookie stariva_src)
    attribution: jsonb("attribution").$type<CampaignAttribution>(),
    ip: text("ip"),
    visitor: jsonb("visitor").$type<VisitorInfo>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("contact_clicks_created_idx").on(table.createdAt),
    index("contact_clicks_browser_idx").on(table.browserId),
    index("contact_clicks_user_id_idx").on(table.userId),
  ],
);
