import { sql } from "drizzle-orm";
import {
  bigint,
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
import { customOrderRequests } from "./custom-order";

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
    // Кампания в Директе: её расход за каждый день сам приходит в расходы
    directCampaignId: bigint("direct_campaign_id", { mode: "number" }),
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
    uniqueIndex("ad_campaigns_direct_campaign_idx").on(table.directCampaignId),
    check(
      "ad_campaigns_utm_campaign_needs_source",
      sql`${table.utmCampaign} IS NULL OR ${table.utmSource} IS NOT NULL`,
    ),
  ],
);

/**
 * Откуда расход: внесён вручную или посчитан по статистике Директа
 * (direct_stats) — такие пересчитываются каждый день и руками не правятся.
 */
export type AdExpenseSource = "manual" | "yandex_direct";

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
    source: text("source").$type<AdExpenseSource>().notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ad_expenses_campaign_idx").on(table.campaignId, table.spentOn),
    // Из Директа — одна строка на кампанию и день
    uniqueIndex("ad_expenses_direct_day_idx")
      .on(table.campaignId, table.spentOn)
      .where(sql`${table.source} = 'yandex_direct'`),
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

/**
 * Площадка, где оформлен заказ мимо корзины сайта. Не путать с рекламным
 * каналом: клиент мог прийти с рекламы во ВКонтакте, а купить на Авито.
 */
export type OrderChannel =
  | "avito"
  | "ozon"
  | "wildberries"
  | "yandex_market"
  | "yarmarka"
  | "telegram"
  | "whatsapp"
  | "instagram"
  | "vk"
  | "offline"
  | "other";

/**
 * Этап заказа вне сайта. done и canceled — закрытые; у отменённого заказа
 * оплаты не идут в выручку: деньги считаются возвращёнными.
 */
export type CrmOrderStatus =
  | "new"
  | "awaiting_payment"
  | "in_production"
  | "ready"
  | "shipped"
  | "done"
  | "canceled";

/**
 * Заказ мимо корзины сайта: индивидуальный заказ по заявке или из
 * мессенджера, заказ на Авито, Ozon или Ярмарке Мастеров, продажа вживую.
 * Ведётся по этапам, деньги — отдельными оплатами (crm_sale_payments).
 */
export const crmSales = pgTable(
  "crm_sales",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clientId: text("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "cascade" }),
    // День заказа по Москве
    soldOn: date("sold_on", { mode: "string" }).notNull(),
    // Сумма заказа в копейках; 0 — цена ещё не согласована
    amount: integer("amount").notNull(),
    description: text("description").notNull(),
    channel: text("channel").$type<OrderChannel>().notNull().default("other"),
    status: text("status").$type<CrmOrderStatus>().notNull().default("new"),
    // Номер заказа или отправления на площадке
    externalNumber: text("external_number"),
    // Срок, к которому обещали сделать или отправить
    dueOn: date("due_on", { mode: "string" }),
    trackingNumber: text("tracking_number"),
    notes: text("notes"),
    // Комиссия площадки и доставка за наш счёт, копейки
    fee: integer("fee").notNull().default(0),
    // С какой рекламы пришёл этот заказ; null — как у клиента
    campaignId: text("campaign_id").references(() => adCampaigns.id, {
      onDelete: "set null",
    }),
    // Заявка с сайта («Обсудим вашу идею»), из которой вырос заказ
    requestNumber: integer("request_number").references(
      () => customOrderRequests.number,
      { onDelete: "restrict" },
    ),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Когда заказ стал выполненным или отменённым
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("crm_sales_client_idx").on(table.clientId),
    uniqueIndex("crm_sales_request_idx").on(table.requestNumber),
    check("crm_sales_amount_not_negative", sql`${table.amount} >= 0`),
    check("crm_sales_fee_not_negative", sql`${table.fee} >= 0`),
  ],
);

/** Деньги по заказу вне сайта: предоплата, доплата или вся сумма сразу. */
export const crmSalePayments = pgTable(
  "crm_sale_payments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    saleId: text("sale_id")
      .notNull()
      .references(() => crmSales.id, { onDelete: "cascade" }),
    // День поступления по Москве; выручка периода — по этим дням
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    // Копейки
    amount: integer("amount").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("crm_sale_payments_sale_idx").on(table.saleId),
    check("crm_sale_payments_amount_positive", sql`${table.amount} > 0`),
  ],
);
