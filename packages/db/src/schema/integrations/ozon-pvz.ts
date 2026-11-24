import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Локальный кэш пунктов выдачи заказов (ПВЗ) Ozon Доставки. Синхронизируется
 * раз в час воркером Hatchet. При недоступности API Ozon — показываем из кэша.
 * Координаты в WGS-84 (lon/lat).
 */
export const ozonPickupPoints = pgTable(
  "ozon_pickup_points",
  {
    /** ID пункта из Ozon (delivery_point_id). */
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    /** Полный адрес строкой. */
    address: text("address").notNull(),
    /** Город. */
    city: text("city"),
    lat: doublePrecision("lat").notNull(),
    lon: doublePrecision("lon").notNull(),
    /** Часы работы — JSON как есть из Ozon. */
    workingHours: jsonb("working_hours"),
    /** Дополнительные атрибуты из Ozon (тип, телефон и т.д.) — JSON. */
    meta: jsonb("meta"),
    isActive: boolean("is_active").notNull().default(true),
    /** Когда последний раз получили из Ozon. */
    syncedAt: timestamp("synced_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    index("ozon_pvz_city_idx").on(t.city),
    index("ozon_pvz_lat_lon_idx").on(t.lat, t.lon),
    index("ozon_pvz_active_idx").on(t.isActive),
  ],
);

export type OzonPickupPoint = typeof ozonPickupPoints.$inferSelect;
export type OzonPickupPointInsert = typeof ozonPickupPoints.$inferInsert;
