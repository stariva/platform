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
  "awaiting_details", // под заказ: оплачен, мастер уточняет у покупателя размер, цвет и доставку
  "in_production", // под заказ: детали согласованы, изделие плетётся
  "ready_to_ship", // под заказ: изделие готово, ждёт отправки
]);

export const productDeliveryMethod = pgEnum("product_delivery_method", [
  "pickup",
  "courier",
  "manual", // изделие под заказ: способ и стоимость доставки согласует мастер
]);

/**
 * Готовое изделие со склада (отправляет Ozon Доставка) или изделие под заказ
 * (плетётся после оплаты, отправляется вручную). Один заказ — один вид.
 */
export const productOrderKind = pgEnum("product_order_kind", [
  "stock",
  "made_to_order",
]);

/** Заказ на товары из каталога, оформленный на сайте и доставляемый Ozon Доставка. */
export const productOrders = pgTable("product_orders", {
  id: text("id").primaryKey(),
  kind: productOrderKind("kind").notNull().default("stock"),
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
  // Под заказ: пожелания покупателя (при оформлении и после оплаты).
  customerNotes: text("customer_notes"),
  // Под заказ: куда и как отправить — покупатель пишет после оплаты,
  // мастер согласует способ и стоимость.
  deliveryNote: text("delivery_note"),
  // Внутренняя заметка мастера, покупателю не показывается.
  masterNotes: text("master_notes"),
  // Под заказ: служба и номер отправления, которые мастер вводит при отправке;
  // покупатель видит их на странице заказа.
  trackingNumber: text("tracking_number"),
  // Когда мастеру ушло уведомление об оплаченном заказе.
  staffNotifiedAt: timestamp("staff_notified_at"),
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
