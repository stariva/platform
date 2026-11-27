import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Вид скидки промокода: процент от изделий или фиксированная сумма в копейках. */
export const promoDiscountType = pgEnum("promo_discount_type", [
  "percent",
  "fixed",
]);

/**
 * Промокоды витрины. Пока применяются только к новогоднему заказу с мгновенной
 * оплатой, но таблица не привязана к конкретной витринной механике.
 * Суммы — в копейках; `usedCount` — созданные заказы с этим кодом (резервы),
 * а не только оплаченные: иначе пара одновременных заказов могла бы пройти
 * сверх лимита.
 */
export const promoCodes = pgTable(
  "promo_codes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Всегда верхний регистр: нормализация в приложении, а это защита от дублей.
    code: text("code").notNull(),
    description: text("description").notNull().default(""),
    discountType: promoDiscountType("discount_type").notNull(),
    // percent — 1..100; fixed — сумма в копейках.
    discountValue: integer("discount_value").notNull(),
    active: boolean("active").notNull().default(true),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    usageLimit: integer("usage_limit"),
    usedCount: integer("used_count").notNull().default(0),
    // Минимальная стоимость изделий до скидки, копейки.
    minOrderAmount: integer("min_order_amount"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("promo_codes_code_idx").on(table.code),
    check(
      "promo_codes_code_format",
      sql`${table.code} ~ '^[A-Z0-9][A-Z0-9-]{2,39}$'`,
    ),
    check("promo_codes_discount_positive", sql`${table.discountValue} > 0`),
    check(
      "promo_codes_percent_range",
      sql`${table.discountType} <> 'percent' OR ${table.discountValue} <= 100`,
    ),
    check(
      "promo_codes_usage_limit_positive",
      sql`${table.usageLimit} IS NULL OR ${table.usageLimit} > 0`,
    ),
    check(
      "promo_codes_min_order_positive",
      sql`${table.minOrderAmount} IS NULL OR ${table.minOrderAmount} > 0`,
    ),
    check(
      "promo_codes_period_order",
      sql`${table.startsAt} IS NULL OR ${table.endsAt} IS NULL OR ${table.endsAt} > ${table.startsAt}`,
    ),
  ],
);
