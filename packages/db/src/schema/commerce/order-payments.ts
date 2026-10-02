import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { productOrderPaymentType, productOrders } from "./orders";

/**
 * Платежи заказа под заказ: предоплата и доплата идут отдельными платежами
 * YooKassa. Строка создаётся, когда покупатель нажимает «Оплатить», — её id
 * служит ключом идемпотентности и попадает в метаданные платежа. Уникальности
 * по этапу нет намеренно: если покупатель оплатит дважды по двум ссылкам,
 * вторая оплата тоже должна записаться, чтобы мастер её вернул.
 */
export const productOrderPayments = pgTable(
  "product_order_payments",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => productOrders.id, { onDelete: "cascade" }),
    type: productOrderPaymentType("type").notNull(),
    // Сумма в копейках — ровно столько запросили у YooKassa
    amount: integer("amount").notNull(),
    status: text("status")
      .$type<"pending" | "succeeded" | "canceled">()
      .notNull()
      .default("pending"),
    yookassaPaymentId: text("yookassa_payment_id"),
    // Ссылка на оплату: повторное нажатие «Оплатить» ведёт на тот же платёж
    confirmationUrl: text("confirmation_url"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    paidAt: timestamp("paid_at"),
    // Когда мастеру ушло уведомление об этой оплате
    staffNotifiedAt: timestamp("staff_notified_at"),
  },
  (table) => [index("product_order_payments_order_idx").on(table.orderId)],
);
