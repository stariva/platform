import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "../auth/user";

/** Статус заказа на товары (каталог, не мастер-классы). */
export const productOrderStatus = pgEnum("product_order_status", [
  "pending", // создан, ожидает оплаты
  "paid", // оплачен, ждём создания заказа в Ozon Доставка
  "canceled", // отменён/истёк до оплаты
  "refunded", // оплачен, но возвращён
  "ozon_order_failed", // оплата прошла, но v2/order/create не удался — нужна ручная обработка
  "fulfilling", // заказ создан в Ozon Доставка, собирается/готовится к отгрузке
  "shipped", // передан в доставку
  "delivered", // получен покупателем
]);

export const productDeliveryMethod = pgEnum("product_delivery_method", [
  "pickup",
  "courier",
]);

/** Заказ на товары из каталога, оформленный на сайте и доставляемый Ozon Доставка. */
export const productOrders = pgTable("product_orders", {
  id: text("id").primaryKey(),
  // Гостевой чек-аут допустим — заказ идентифицируется по contactPhone,
  // а не только по аккаунту.
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone").notNull(),
  contactEmail: text("contact_email"),
  status: productOrderStatus("status").notNull().default("pending"),
  // Суммы в копейках
  amountProducts: integer("amount_products").notNull(),
  amountDelivery: integer("amount_delivery").notNull().default(0),
  amountTotal: integer("amount_total").notNull(),
  currency: text("currency").notNull().default("RUB"),
  // Идентификатор платежа в YooKassa
  paymentId: text("payment_id"),
  deliveryMethod: productDeliveryMethod("delivery_method").notNull(),
  deliveryPointId: text("delivery_point_id"),
  // { address: string; lat: number; lng: number } — для курьерской доставки
  deliveryAddress: jsonb("delivery_address"),
  // Точный ответ v2/delivery/checkout — состав/сроки нельзя менять после
  // создания заказа в Ozon, поэтому воспроизводим ровно то, что показали
  // покупателю при оформлении.
  checkoutSnapshot: jsonb("checkout_snapshot"),
  // Заполняются после успешного v2/order/create
  ozonOrderId: text("ozon_order_id"),
  ozonPostingNumbers: text("ozon_posting_numbers").array(),
  ozonShipmentStatus: text("ozon_shipment_status")
    .$type<"pending" | "creating" | "failed" | "created">()
    .notNull()
    .default("pending"),
  ozonShipmentAttemptId: text("ozon_shipment_attempt_id"),
  ozonShipmentAttemptedAt: timestamp("ozon_shipment_attempted_at"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  paidAt: timestamp("paid_at"),
});
