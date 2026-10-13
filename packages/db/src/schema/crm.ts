import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Где крутится реклама: по каналу кампании складываются в сводке. */
export type AdChannel =
  | "yandex_direct"
  | "vk_ads"
  | "telegram"
  | "avito"
  | "bloggers"
  | "social"
  | "other";

/**
 * Рекламная кампания, на которую тратятся деньги. Заказы с сайта попадают в
 * неё по UTM-метке первого захода: utm_source совпадает, а utm_campaign либо
 * совпадает, либо у кампании не задан (тогда в неё идут все кампании этого
 * источника, кроме заведённых отдельно). Без меток кампания — для клиентов,
 * которых отмечают вручную: Авито, посевы, сарафан.
 */
export const adCampaigns = pgTable(
  "ad_campaigns",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    channel: text("channel").$type<AdChannel>().notNull().default("other"),
    // Метки хранятся в нижнем регистре: в ссылках их пишут как попало
    utmSource: text("utm_source"),
    utmCampaign: text("utm_campaign"),
    notes: text("notes"),
    // Закончилась: не предлагается новым клиентам, но остаётся в сводке
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [
    // Пустой utm_campaign — тоже значение: на весь source одна кампания
    uniqueIndex("ad_campaigns_utm_idx")
      .on(table.utmSource, sql`coalesce(${table.utmCampaign}, '')`)
      .where(sql`${table.utmSource} IS NOT NULL`),
    check(
      "ad_campaigns_utm_campaign_needs_source",
      sql`${table.utmCampaign} IS NULL OR ${table.utmSource} IS NOT NULL`,
    ),
  ],
);

/** Расход на кампанию: пополнение кабинета, оплата посева или блогера. */
export const adExpenses = pgTable(
  "ad_expenses",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => adCampaigns.id, { onDelete: "cascade" }),
    // День расхода по Москве; за период в сводку идут расходы этих дней
    spentOn: date("spent_on", { mode: "string" }).notNull(),
    // Копейки, как в заказах
    amount: integer("amount").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ad_expenses_campaign_idx").on(table.campaignId, table.spentOn),
    check("ad_expenses_amount_positive", sql`${table.amount} > 0`),
  ],
);

/**
 * Карточка клиента в CRM. Клиенты с сайта собираются из заказов по телефону
 * и почте и карточки не требуют; строка появляется, когда клиента заводят
 * вручную (пришёл в мессенджер, купил на Авито) или правят источник и
 * заметки. По телефону и почте карточка склеивается с заказами.
 */
export const crmClients = pgTable(
  "crm_clients",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    // Только цифры, с 7 в начале для российских номеров
    phone: text("phone"),
    // В нижнем регистре
    email: text("email"),
    // sourceManual — источник выбран вручную и UTM-метки заказов его не
    // перетирают; тогда campaignId null значит «не с рекламы».
    sourceManual: boolean("source_manual").notNull().default(false),
    campaignId: text("campaign_id").references(() => adCampaigns.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("crm_clients_phone_idx").on(table.phone),
    uniqueIndex("crm_clients_email_idx").on(table.email),
  ],
);

/** Продажа мимо сайта: Авито, перевод на карту, мастер-класс вживую. */
export const crmSales = pgTable(
  "crm_sales",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clientId: text("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "cascade" }),
    soldOn: date("sold_on", { mode: "string" }).notNull(),
    // Копейки
    amount: integer("amount").notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("crm_sales_client_idx").on(table.clientId),
    check("crm_sales_amount_positive", sql`${table.amount} > 0`),
  ],
);
