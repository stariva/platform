import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { orders } from "./orders";

/**
 * Одноразовый код доступа к мастер-классу для покупок на маркетплейсах
 * (Ярмарка Мастеров): ссылки там отправлять нельзя, поэтому мастер пишет
 * покупателю код, а тот вводит его на stariva.ru/code. Активация создаёт
 * оплаченный заказ — дальше всё как при покупке на сайте.
 */
export const workshopAccessCodes = pgTable(
  "workshop_access_codes",
  {
    id: text("id").primaryKey(),
    // Без дефиса и в верхнем регистре: «482 719» хранится как «482719»
    code: text("code").notNull().unique(),
    workshopSlug: text("workshop_slug").notNull(),
    // Где продан курс: livemaster
    channel: text("channel").notNull(),
    // Цена курса на момент выдачи кода, в копейках, — уходит в заказ
    amount: integer("amount").notNull(),
    // Пометка мастера: номер заказа на Ярмарке или имя покупателя
    note: text("note"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    redeemedAt: timestamp("redeemed_at"),
    orderId: text("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("workshop_access_codes_workshop_idx").on(t.workshopSlug)],
);

/** Неверные коды по IP — предел попыток против перебора. */
export const accessCodeAttempts = pgTable(
  "access_code_attempts",
  {
    id: text("id").primaryKey(),
    ip: text("ip").notNull(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [index("access_code_attempts_ip_idx").on(t.ip, t.createdAt)],
);
