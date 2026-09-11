import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Единственная строка (id = "current") хранит актуальный refresh_token
 * приватного OAuth-приложения Ozon Доставки. Ozon может выдавать новый
 * refresh_token при каждом обновлении access_token и инвалидировать старый —
 * без сохранения нового значения следующий рефреш падает с
 * invalid_refresh_token. Значение в env остаётся только начальным seed'ом.
 */
export const ozonDeliveryToken = pgTable("ozon_delivery_token", {
  id: text("id").primaryKey(),
  refreshToken: text("refresh_token").notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
});
