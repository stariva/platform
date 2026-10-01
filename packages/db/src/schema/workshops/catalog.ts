import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const workshopCategory = pgEnum("workshop_category", [
  "lampshades",
  "clothing",
  "interior",
]);

export const workshopLevel = pgEnum("workshop_level", [
  "beginner",
  "intermediate",
  "advanced",
]);

export const workshopStatus = pgEnum("workshop_status", [
  "draft", // заводится в админке, на сайте не виден
  "published", // в каталоге, можно купить
  "archived", // не продаётся и не в каталоге, но купившие смотрят дальше
]);

/** Урок внутри мастер-класса. Хранится массивом в workshops.lessons. */
export interface WorkshopLessonData {
  /** Стабильный id: на него ссылается lesson_progress. */
  id: string;
  title: string;
  durationSeconds: number;
  /** Ключ видео в закрытом бакете. Пусто — видео ещё не загружено. */
  videoKey: string;
  /** Бесплатное превью — смотреть можно без покупки. */
  free: boolean;
}

/** PDF к курсу в закрытом бакете. */
export interface WorkshopMaterialFileData {
  label: string;
  key: string;
}

/**
 * Мастер-класс (видеокурс). Источник правды для сайта — эта таблица.
 *
 * slug — связующее звено с orders, course_access, lesson_progress и
 * certificates (они ссылаются на него текстом), поэтому после создания он не
 * меняется. Уроки и PDF — массивами в jsonb: правятся только целиком, формой.
 */
export const workshops = pgTable(
  "workshops",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    description: text("description").notNull().default(""),
    category: workshopCategory("category").notNull(),
    level: workshopLevel("level").notNull().default("beginner"),
    status: workshopStatus("status").notNull().default("draft"),

    // Копейки, как в заказах. 0 — бесплатный курс.
    price: integer("price").notNull().default(0),

    // Картинка из публичного бакета (https://…) или файл из public/ сайта (/images/…)
    cover: text("cover").notNull().default(""),
    previewImage: text("preview_image").notNull().default(""),

    whatYouLearn: text("what_you_learn")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    materials: text("materials").array().notNull().default(sql`'{}'::text[]`),
    lessons: jsonb("lessons")
      .$type<WorkshopLessonData[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    materialFiles: jsonb("material_files")
      .$type<WorkshopMaterialFileData[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    ozonUrl: text("ozon_url"),
    testimonialText: text("testimonial_text"),
    testimonialAuthor: text("testimonial_author"),

    featured: boolean("featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("workshops_slug_idx").on(table.slug),
    index("workshops_listing_idx").on(
      table.status,
      table.category,
      table.sortOrder,
    ),
    check("workshops_price_non_negative", sql`${table.price} >= 0`),
  ],
);

export type WorkshopRow = typeof workshops.$inferSelect;
export type NewWorkshopRow = typeof workshops.$inferInsert;
