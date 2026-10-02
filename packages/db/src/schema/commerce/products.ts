import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const productCategory = pgEnum("product_category", [
  "clothes",
  "interior",
  "bags",
]);

/** Принадлежность подкатегории к категории проверяется в приложении. */
export const productSubcategory = pgEnum("product_subcategory", [
  "dresses",
  "tops",
  "belts",
  "lampshades",
  "tipis",
  "pannos",
  "placemats",
  "planters",
  "baskets",
  "totes",
  "crossbody",
]);

export const productStatus = pgEnum("product_status", [
  "draft", // заводится в админке, на сайте не виден
  "published", // виден на сайте
  "archived", // снят с сайта, URL отдаёт 404/редирект
]);

/**
 * Товар каталога. Источник правды для сайта — эта таблица, а не Ozon.
 *
 * Изделие может быть одновременно в наличии (готовые экземпляры на нашем
 * FBS-складе, продаются через Ozon Доставку по ozonSku) и доступно под заказ
 * (madeToOrder — плетём по меркам/цвету покупателя).
 */
export const products = pgTable(
  "products",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Сохраняем slug из Ozon-периода при импорте — по ним уже проиндексированы URL
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    // HTML, как и раньше приходило из Ozon
    description: text("description").notNull().default(""),
    category: productCategory("category").notNull(),
    subcategory: productSubcategory("subcategory").notNull(),
    status: productStatus("status").notNull().default("draft"),

    // Суммы в копейках, как в заказах
    price: integer("price").notNull(),
    oldPrice: integer("old_price"),

    // Фото в порядке показа, первое — обложка
    images: text("images").array().notNull().default(sql`'{}'::text[]`),
    material: text("material"),
    color: text("color"),
    dimensions: text("dimensions"),
    careInstructions: text("care_instructions"),
    sizes: text("sizes").array().notNull().default(sql`'{}'::text[]`),

    // ── Под заказ ──
    madeToOrder: boolean("made_to_order").notNull().default(true),
    // null — берём общий срок изготовления из made-to-order.ts
    leadTimeMinDays: integer("lead_time_min_days"),
    leadTimeMaxDays: integer("lead_time_max_days"),

    // ── В наличии (Ozon FBS + Ozon Доставка) ──
    ozonProductId: bigint("ozon_product_id", { mode: "number" }),
    ozonOfferId: text("ozon_offer_id"),
    // fbs_sku — нужен для v2/delivery/checkout и v2/order/create
    ozonSku: bigint("ozon_sku", { mode: "number" }),
    // Остаток готовых изделий. Ведётся у нас: правится в админке, при оплате
    // заказа списывается. Ozon Доставка отгружает только остаток, числящийся
    // на Ozon, поэтому правки из админки дублируются на FBS-склад Ozon.
    stockAvailable: integer("stock_available").notNull().default(0),
    // Не используется: остатки больше не сверяются с Ozon
    stockSyncedAt: timestamp("stock_synced_at", { withTimezone: true }),

    // ── Витрина ──
    featured: boolean("featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("products_slug_idx").on(table.slug),
    uniqueIndex("products_ozon_product_id_idx").on(table.ozonProductId),
    uniqueIndex("products_ozon_offer_id_idx").on(table.ozonOfferId),
    uniqueIndex("products_ozon_sku_idx").on(table.ozonSku),
    index("products_listing_idx").on(
      table.status,
      table.category,
      table.sortOrder,
    ),
    check("products_price_positive", sql`${table.price} > 0`),
    check(
      "products_old_price_gt_price",
      sql`${table.oldPrice} IS NULL OR ${table.oldPrice} > ${table.price}`,
    ),
    check("products_stock_non_negative", sql`${table.stockAvailable} >= 0`),
    check(
      "products_lead_time_range",
      sql`(${table.leadTimeMinDays} IS NULL) = (${table.leadTimeMaxDays} IS NULL)
        AND (${table.leadTimeMinDays} IS NULL
          OR (${table.leadTimeMinDays} > 0 AND ${table.leadTimeMinDays} <= ${table.leadTimeMaxDays}))`,
    ),
    // Нельзя продавать «в наличии» без SKU для Ozon Доставки
    check(
      "products_stock_requires_sku",
      sql`${table.stockAvailable} = 0 OR ${table.ozonSku} IS NOT NULL`,
    ),
  ],
);

export type ProductRow = typeof products.$inferSelect;
export type NewProductRow = typeof products.$inferInsert;
