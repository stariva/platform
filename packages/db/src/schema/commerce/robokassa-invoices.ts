import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { orders } from "../workshops/orders";
import { productOrders } from "./orders";

/**
 * Счета Robokassa (Яндекс Пэй и Сплит). Robokassa знает платёж только по
 * числовому номеру счёта, а id заказов у нас текстовые: номер выдаёт эта
 * таблица, и в заказ он попадает как paymentId «robokassa:<номер>». Сумму
 * храним свою — уведомление и запрос статуса сверяются с ней. Счёт
 * принадлежит ровно одному заказу: на товары или на мастер-класс.
 */
export const robokassaInvoices = pgTable(
  "robokassa_invoices",
  {
    // InvId в Robokassa: повторно использовать номер нельзя (ошибка 40)
    id: integer("id")
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1001 }),
    productOrderId: text("product_order_id").references(
      () => productOrders.id,
      { onDelete: "cascade" },
    ),
    workshopOrderId: text("workshop_order_id").references(() => orders.id, {
      onDelete: "cascade",
    }),
    // Сумма в копейках — ровно столько запросили у Robokassa
    amount: integer("amount").notNull(),
    // Способ из уведомления об оплате: YandexPay, YandexPaySplit…
    paymentMethod: text("payment_method"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    index("robokassa_invoices_product_order_idx").on(t.productOrderId),
    index("robokassa_invoices_workshop_order_idx").on(t.workshopOrderId),
    check(
      "robokassa_invoices_one_order",
      sql`num_nonnulls(${t.productOrderId}, ${t.workshopOrderId}) = 1`,
    ),
  ],
);
