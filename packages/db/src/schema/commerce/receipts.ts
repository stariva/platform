import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { orders } from "../workshops/orders";
import { productOrders } from "./orders";

/**
 * Чеки НПД, которые мастер сформировала в «Мой налог» и привязала к заказу
 * ссылкой. У заказа под заказ их несколько — на предоплату и на доплату.
 * Чек принадлежит ровно одному заказу: на товары или на мастер-класс.
 */
export const orderReceipts = pgTable(
  "order_receipts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    productOrderId: text("product_order_id").references(
      () => productOrders.id,
      { onDelete: "cascade" },
    ),
    workshopOrderId: text("workshop_order_id").references(() => orders.id, {
      onDelete: "cascade",
    }),
    // ИНН продавца и номер чека из ссылки lknpd.nalog.ru/api/v1/receipt/<ИНН>/<номер>/print
    inn: text("inn").notNull(),
    number: text("number").notNull(),
    // Картинка чека на сервисе ФНС
    url: text("url").notNull(),
    // Наша копия картинки в публичном бакете: покупатель получает её, а не
    // ссылку на ФНС, которая бывает недоступна. null — копию не снимали
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Последнее письмо с чеком покупателю; null — ещё не отправляли
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    emailedTo: text("emailed_to"),
  },
  (t) => [
    uniqueIndex("order_receipts_inn_number_idx").on(t.inn, t.number),
    index("order_receipts_product_order_idx").on(t.productOrderId),
    index("order_receipts_workshop_order_idx").on(t.workshopOrderId),
    check(
      "order_receipts_one_order",
      sql`num_nonnulls(${t.productOrderId}, ${t.workshopOrderId}) = 1`,
    ),
  ],
);
