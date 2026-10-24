import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  pgView,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Выгрузка Яндекс Метрики и Директа для анализа покупателей.
 *
 * Метрика (Logs API) отдаёт сырые визиты и события по каждому браузеру.
 * Связь с нашими заказами — по ClientID: сайт кладёт его в orders.visitor
 * (ymClientId) в момент заказа. Директ (Reports API) отдаёт только суммы
 * по срезам: пол, возраст, доход, устройство, регион, площадка, фраза —
 * конкретного человека в них нет.
 *
 * В `data` лежат все выгруженные поля как есть: имена без префикса
 * ym:s: / ym:pv:, строки и массивы. Отдельные колонки — то, по чему чаще
 * всего соединяют и фильтруют.
 */

/** Цели счётчика: имена для goal_ids в визитах и событиях. */
export const metrikaGoals = pgTable("metrika_goals", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Визиты из Logs API Метрики (source=visits). */
export const metrikaVisits = pgTable(
  "metrika_visits",
  {
    visitId: text("visit_id").primaryKey(),
    // ClientID Метрики (_ym_uid) — тот же, что orders.visitor->>'ymClientId'
    clientId: text("client_id"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    isNewUser: boolean("is_new_user"),
    startUrl: text("start_url"),
    endUrl: text("end_url"),
    pageViews: integer("page_views"),
    // Секунды
    duration: integer("duration"),
    bounce: boolean("bounce"),
    // Источник по модели «последний значимый переход», как в отчётах Метрики:
    // ad, organic, direct, internal, referral, social, messenger, recommend…
    trafficSource: text("traffic_source"),
    // Источник самого первого визита этого браузера
    firstTrafficSource: text("first_traffic_source"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    // Переход из Директа (последний значимый): кампания, группа, объявление,
    // условие показа (фраза или автотаргетинг), площадка
    directCampaignId: bigint("direct_campaign_id", { mode: "number" }),
    directAdGroupId: bigint("direct_ad_group_id", { mode: "number" }),
    directAdId: text("direct_ad_id"),
    directPhrase: text("direct_phrase"),
    directConditionType: text("direct_condition_type"),
    directPlatformType: text("direct_platform_type"),
    directPlatform: text("direct_platform"),
    country: text("country"),
    city: text("city"),
    deviceCategory: text("device_category"),
    operatingSystem: text("operating_system"),
    browser: text("browser"),
    goalIds: bigint("goal_ids", { mode: "number" }).array(),
    purchaseIds: text("purchase_ids").array(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("metrika_visits_client_idx").on(t.clientId),
    index("metrika_visits_started_idx").on(t.startedAt),
  ],
);

/** Просмотры страниц и события из Logs API Метрики (source=hits). */
export const metrikaHits = pgTable(
  "metrika_hits",
  {
    watchId: text("watch_id").primaryKey(),
    visitId: text("visit_id"),
    clientId: text("client_id"),
    at: timestamp("at", { withTimezone: true }).notNull(),
    url: text("url"),
    title: text("title"),
    referer: text("referer"),
    isPageView: boolean("is_page_view"),
    goalIds: bigint("goal_ids", { mode: "number" }).array(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("metrika_hits_client_idx").on(t.clientId),
    index("metrika_hits_visit_idx").on(t.visitId),
    index("metrika_hits_at_idx").on(t.at),
  ],
);

/** Конверсии и доход по целям Метрики: { "<id цели>": число }. */
export type GoalValues = Record<string, number>;

/**
 * Статистика Директа по дням во всех срезах сразу (CUSTOM_REPORT). Строка —
 * сочетание кампании, объявления, условия показа, аудитории (пол, возраст,
 * доход), устройства, региона и площадки. Суммировать можно любые колонки
 * с показами, кликами, расходом и конверсиями.
 */
export const directStats = pgTable(
  "direct_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date").notNull(),
    campaignId: bigint("campaign_id", { mode: "number" }),
    campaignName: text("campaign_name"),
    campaignType: text("campaign_type"),
    adGroupId: bigint("ad_group_id", { mode: "number" }),
    adGroupName: text("ad_group_name"),
    // Id объявлений длиннее 2^53 — строкой
    adId: text("ad_id"),
    adFormat: text("ad_format"),
    criterionId: text("criterion_id"),
    criterion: text("criterion"),
    criterionType: text("criterion_type"),
    matchType: text("match_type"),
    targetingCategory: text("targeting_category"),
    // AGE_18_24 … AGE_55, UNKNOWN
    age: text("age"),
    // GENDER_MALE, GENDER_FEMALE, UNKNOWN
    gender: text("gender"),
    // VERY_HIGH, HIGH, ABOVE_AVERAGE, OTHER
    incomeGrade: text("income_grade"),
    device: text("device"),
    mobilePlatform: text("mobile_platform"),
    carrierType: text("carrier_type"),
    // Где был человек при показе и какой регион таргетинга сработал
    locationId: bigint("location_id", { mode: "number" }),
    locationName: text("location_name"),
    targetingLocationId: bigint("targeting_location_id", { mode: "number" }),
    targetingLocationName: text("targeting_location_name"),
    // SEARCH или AD_NETWORK (РСЯ)
    adNetworkType: text("ad_network_type"),
    placement: text("placement"),
    externalNetworkName: text("external_network_name"),
    slot: text("slot"),
    impressions: integer("impressions").notNull(),
    clicks: integer("clicks").notNull(),
    // Рубли с НДС
    cost: numeric("cost", {
      precision: 14,
      scale: 2,
      mode: "number",
    }).notNull(),
    bounces: integer("bounces"),
    sessions: integer("sessions"),
    conversions: jsonb("conversions").$type<GoalValues>(),
    revenue: jsonb("revenue").$type<GoalValues>(),
    data: jsonb("data").$type<Record<string, string>>().notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("direct_stats_date_idx").on(t.date),
    index("direct_stats_campaign_idx").on(t.campaignId),
  ],
);

/** Реальные поисковые запросы, по которым показывались объявления. */
export const directSearchQueries = pgTable(
  "direct_search_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date").notNull(),
    campaignId: bigint("campaign_id", { mode: "number" }),
    campaignName: text("campaign_name"),
    adGroupId: bigint("ad_group_id", { mode: "number" }),
    adGroupName: text("ad_group_name"),
    // Id объявлений длиннее 2^53 — строкой
    adId: text("ad_id"),
    query: text("query"),
    criterionId: text("criterion_id"),
    criterion: text("criterion"),
    criterionType: text("criterion_type"),
    matchedKeyword: text("matched_keyword"),
    matchType: text("match_type"),
    targetingCategory: text("targeting_category"),
    incomeGrade: text("income_grade"),
    placement: text("placement"),
    impressions: integer("impressions").notNull(),
    clicks: integer("clicks").notNull(),
    cost: numeric("cost", {
      precision: 14,
      scale: 2,
      mode: "number",
    }).notNull(),
    bounces: integer("bounces"),
    conversions: jsonb("conversions").$type<GoalValues>(),
    revenue: jsonb("revenue").$type<GoalValues>(),
    data: jsonb("data").$type<Record<string, string>>().notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("direct_search_queries_date_idx").on(t.date)],
);

/**
 * Оплаченные мастер-классы вместе с тем, что о покупателе знает сайт (город,
 * устройство, UTM) и Метрика (визиты до оплаты, первый источник, переход из
 * Директа). Визиты есть, только если покупатель согласился на аналитику и
 * ClientID попал в заказ.
 */
export const workshopBuyers = pgView("workshop_buyers", {
  orderId: text("order_id"),
  userId: text("user_id"),
  workshopSlug: text("workshop_slug"),
  amount: integer("amount"),
  createdAt: timestamp("created_at"),
  paidAt: timestamp("paid_at"),
  clientId: text("client_id"),
  city: text("city"),
  region: text("region"),
  device: text("device"),
  deviceModel: text("device_model"),
  os: text("os"),
  browser: text("browser"),
  utmSourceFirst: text("utm_source_first"),
  utmCampaignFirst: text("utm_campaign_first"),
  utmSourceLast: text("utm_source_last"),
  utmCampaignLast: text("utm_campaign_last"),
  visitsBefore: integer("visits_before"),
  pageViewsBefore: integer("page_views_before"),
  secondsOnSiteBefore: integer("seconds_on_site_before"),
  firstVisitAt: timestamp("first_visit_at", { withTimezone: true }),
  daysToPurchase: numeric("days_to_purchase", { mode: "number" }),
  firstVisitSource: text("first_visit_source"),
  firstVisitStartUrl: text("first_visit_start_url"),
  lastVisitSource: text("last_visit_source"),
  lastVisitStartUrl: text("last_visit_start_url"),
  directCampaignId: bigint("direct_campaign_id", { mode: "number" }),
  directAdGroupId: bigint("direct_ad_group_id", { mode: "number" }),
  directAdId: text("direct_ad_id"),
  directPhrase: text("direct_phrase"),
  directConditionType: text("direct_condition_type"),
  directPlatformType: text("direct_platform_type"),
  directPlatform: text("direct_platform"),
  metrikaCity: text("metrika_city"),
  metrikaDevice: text("metrika_device"),
}).as(sql`
  select
    o.id as order_id,
    o.user_id,
    o.workshop_slug,
    o.amount,
    o.created_at,
    o.paid_at,
    o.visitor->>'ymClientId' as client_id,
    o.visitor->>'city' as city,
    o.visitor->>'region' as region,
    o.visitor->>'device' as device,
    o.visitor->>'deviceModel' as device_model,
    o.visitor->>'os' as os,
    o.visitor->>'browser' as browser,
    o.attribution->'first'->>'utm_source' as utm_source_first,
    o.attribution->'first'->>'utm_campaign' as utm_campaign_first,
    o.attribution->'last'->>'utm_source' as utm_source_last,
    o.attribution->'last'->>'utm_campaign' as utm_campaign_last,
    s.visits as visits_before,
    s.page_views as page_views_before,
    s.seconds as seconds_on_site_before,
    s.first_at as first_visit_at,
    round(extract(epoch from (coalesce(o.paid_at, o.created_at) at time zone 'UTC' - s.first_at)) / 86400, 1) as days_to_purchase,
    fv.traffic_source as first_visit_source,
    fv.start_url as first_visit_start_url,
    lv.traffic_source as last_visit_source,
    lv.start_url as last_visit_start_url,
    lv.direct_campaign_id,
    lv.direct_ad_group_id,
    lv.direct_ad_id,
    lv.direct_phrase,
    lv.direct_condition_type,
    lv.direct_platform_type,
    lv.direct_platform,
    lv.city as metrika_city,
    lv.device_category as metrika_device
  from orders o
  left join lateral (
    select
      count(*)::int as visits,
      sum(v.page_views)::int as page_views,
      sum(v.duration)::int as seconds,
      min(v.started_at) as first_at
    from metrika_visits v
    where v.client_id = o.visitor->>'ymClientId'
      and v.started_at <= coalesce(o.paid_at, o.created_at) at time zone 'UTC'
  ) s on true
  left join lateral (
    select v.traffic_source, v.start_url
    from metrika_visits v
    where v.client_id = o.visitor->>'ymClientId'
    order by v.started_at
    limit 1
  ) fv on true
  left join lateral (
    select v.*
    from metrika_visits v
    where v.client_id = o.visitor->>'ymClientId'
      and v.started_at <= coalesce(o.paid_at, o.created_at) at time zone 'UTC'
    order by v.started_at desc
    limit 1
  ) lv on true
  where o.status = 'paid'
`);
