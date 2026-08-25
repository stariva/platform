import { integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "../auth/user";

/** Статусы заказа/платежа. */
export const orderStatus = pgEnum("order_status", [
  "pending", // создан, ожидает оплаты
  "paid", // оплачен, доступ выдан
  "canceled", // отменён/истёк
  "refunded", // возврат
]);

/** Заказ на покупку мастер-класса. */
export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  workshopSlug: text("workshop_slug").notNull(),
  // Сумма в копейках, чтобы избежать ошибок с плавающей точкой
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("RUB"),
  status: orderStatus("status").notNull().default("pending"),
  // Идентификатор платежа в YooKassa
  paymentId: text("payment_id"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  paidAt: timestamp("paid_at"),
});
