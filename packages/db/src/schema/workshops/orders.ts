import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "../auth/user";

/** Статусы заказа/платежа. */
export const orderStatus = pgEnum("order_status", [
  "pending", // создан, ожидает оплаты
  "paid", // оплачен, доступ выдан
  "canceled", // отменён/истёк
  "refunded", // возврат
]);

/** Заказ на покупку мастер-класса. */
export const orders = pgTable(
  "orders",
  {
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

    // Email, на который пришлём доступ и напоминания (на момент заказа)
    contactEmail: text("contact_email"),
    // Личная ссылка входа из писем: открывает кабинет без пароля.
    // Уходит только на email покупателя. null — заказ до гостевой оплаты.
    accessToken: text("access_token"),
    // Метка для привязки Telegram (t.me/<бот>?start=<метка>). Отдельна от
    // accessToken: её видит браузер, оплативший заказ, а не владелец почты.
    telegramToken: text("telegram_token"),
    telegramChatId: text("telegram_chat_id"),
  },
  (t) => [
    uniqueIndex("orders_access_token_idx").on(t.accessToken),
    uniqueIndex("orders_telegram_token_idx").on(t.telegramToken),
  ],
);

/**
 * Отправленные покупателю письма и сообщения по заказу мастер-класса.
 * Строка — право на одну отправку: вставляем перед отправкой, удаляем при
 * сбое. Так повторный вебхук или параллельный запуск напоминаний не пришлёт
 * письмо дважды.
 */
export const workshopOrderNotifications = pgTable(
  "workshop_order_notifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    // booked | week | day | release
    kind: text("kind").notNull(),
    // email | telegram
    channel: text("channel").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("workshop_order_notifications_uq").on(t.orderId, t.kind, t.channel),
  ],
);
