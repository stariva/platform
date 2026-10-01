import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { products } from "./products";

export const reviewSource = pgEnum("review_source", [
  "ozon", // перенесён с Ozon
  "avito", // перенесён с Авито
  "site", // оставлен напрямую на сайте
]);

/**
 * Отзыв покупателя. Источник правды для сайта — эта таблица.
 *
 * Отзывы с маркетплейсов переносятся сюда как есть, но на сайте виден только
 * тот, что отмечен published: фото и имя автора — его персональные данные,
 * поэтому каждый отзыв сначала проверяют в админке. Фото можно скрыть
 * отдельно (showPhotos), не убирая сам отзыв.
 *
 * К каким товарам относится отзыв — в review_products: объявление на Авито —
 * это модель во всех цветах, а у нас отдельная карточка на каждый цвет.
 */
export const reviews = pgTable(
  "reviews",
  {
    // Для отзывов с Ozon — их uuid, с Авито — avito-…, чтобы повторный импорт
    // не плодил дубли
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    source: reviewSource("source").notNull().default("ozon"),
    rating: integer("rating").notNull(),
    text: text("text").notNull(),
    // Как автор подписан на витрине: имя и первая буква фамилии
    reviewerName: text("reviewer_name").notNull(),
    // Товар, как он назван в источнике: артикул Ozon и название карточки или
    // объявления. На витрину отзыв попадает по review_products, не по ним.
    productOfferId: text("product_offer_id"),
    productTitle: text("product_title"),
    // Ссылки на фото в нашем публичном бакете (пока не перенесены — на CDN Ozon)
    photos: text("photos").array().notNull().default(sql`'{}'::text[]`),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),

    // Показывать ли отзыв на сайте. Новые отзывы скрыты, пока их не проверили.
    published: boolean("published").notNull().default(false),
    showPhotos: boolean("show_photos").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("reviews_listing_idx").on(table.published, table.reviewedAt),
    index("reviews_product_offer_id_idx").on(table.productOfferId),
    check("reviews_rating_range", sql`${table.rating} BETWEEN 1 AND 5`),
  ],
);

/**
 * Товары, на карточках которых показывается отзыв. Отзыв без связей — отзыв
 * о мастерской: виден только в общих блоках.
 */
export const reviewProducts = pgTable(
  "review_products",
  {
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.reviewId, table.productId] }),
    index("review_products_product_id_idx").on(table.productId),
  ],
);

export type ReviewRow = typeof reviews.$inferSelect;
export type NewReviewRow = typeof reviews.$inferInsert;
