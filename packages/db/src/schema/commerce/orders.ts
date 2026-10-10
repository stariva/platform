import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { CampaignAttribution } from "../attribution";
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
  // Под заказ: заявка → согласование с мастером → предоплата → изготовление → доплата → отправка
  "requested", // под заказ: заявка без оплаты, мастер связывается с покупателем
  "in_production", // под заказ: предоплата получена, изделие плетётся
  "ready_to_ship", // под заказ: оплачен полностью, ждёт отправки
  "awaiting_deposit", // под заказ: мастер одобрил и выставил предоплату
  "awaiting_balance", // под заказ: изделие готово, ждём доплату
  "declined", // под заказ: мастер отклонил заявку
]);

/** Этап оплаты заказа под заказ: предоплата при одобрении, доплата перед отправкой. */
export const productOrderPaymentType = pgEnum("product_order_payment_type", [
  "deposit",
  "balance",
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
  // Под заказ: пожелания покупателя (в заявке и до одобрения).
  customerNotes: text("customer_notes"),
  // Под заказ: куда и как отправить — покупатель пишет в заявке,
  // мастер согласует способ и стоимость.
  deliveryNote: text("delivery_note"),
  // Под заказ: предоплата в копейках, фиксируется при одобрении;
  // доплата — amountTotal минус предоплата.
  depositAmount: integer("deposit_amount"),
  // Под заказ: срок изготовления, который мастер назвал покупателю.
  leadTime: text("lead_time"),
  // Под заказ: до какого момента ждём текущую оплату (предоплату или доплату).
  paymentDueAt: timestamp("payment_due_at"),
  approvedAt: timestamp("approved_at"),
  depositPaidAt: timestamp("deposit_paid_at"),
  // Под заказ: почему мастер отклонил заявку — покупатель видит на странице заказа.
  declineReason: text("decline_reason"),
  // UTM первого и последнего захода до заказа; null — пришли не по метке.
  attribution: jsonb("attribution").$type<CampaignAttribution>(),
  // Внутренняя заметка мастера, покупателю не показывается.
  masterNotes: text("master_notes"),
  // Под заказ: служба и номер отправления, которые мастер вводит при отправке;
  // покупатель видит их на странице заказа.
  trackingNumber: text("tracking_number"),
  // Когда мастеру ушло уведомление об оплаченном заказе или новой заявке.
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
