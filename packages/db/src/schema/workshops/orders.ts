import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { CampaignAttribution } from "../attribution";
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
    // UTM первого и последнего захода до заказа; null — пришли не по метке.
    attribution: jsonb("attribution").$type<CampaignAttribution>(),
  },
  (t) => [
    uniqueIndex("orders_access_token_idx").on(t.accessToken),
    uniqueIndex("orders_telegram_token_idx").on(t.telegramToken),
  ],
);

/**
 * Отправки по заказу: sentAt заполнен только после успеха. Незавершённую
 * отправку можно повторить после leaseUntil; id меняется при перехвате
 * аренды, чтобы старый воркер не завершил и не удалил новую попытку.
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
    sentAt: timestamp("sent_at", { withTimezone: true }),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
  },
  (t) => [
    unique("workshop_order_notifications_uq").on(t.orderId, t.kind, t.channel),
  ],
);
