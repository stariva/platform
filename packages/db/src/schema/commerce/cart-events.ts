import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "../auth/user";
import type { VisitorInfo } from "../visitor";
import { productOrders } from "./orders";

export const CART_EVENT_ACTIONS = [
  "add", // положил изделие или ещё одно такое же
  "remove", // убрал строку (сам или сайт: товар раскупили)
  "quantity", // поменял количество в корзине
  "clear", // «Очистить корзину»
  "sync", // сайт подрезал количество под остаток
  "order", // оформил заказ или заявку: оформленные строки ушли из корзины
] as const;
export type CartEventAction = (typeof CART_EVENT_ACTIONS)[number];

/** Строка корзины так, как её видел браузер: цена в копейках. */
export interface CartEventItem {
  productSlug: string;
  fulfillmentType: "stock" | "made_to_order";
  name: string;
  image?: string;
  price: number;
  quantity: number;
  /** Размер и цвет изделия под заказ. */
  options?: { size: string; color: string };
}

/** Что поменялось в строке: количество до и после (0 — строки не было или не стало). */
export interface CartEventChange
  extends Omit<CartEventItem, "quantity" | "image"> {
  before: number;
  after: number;
}

/**
 * Журнал корзин. Сама корзина живёт в localStorage браузера, поэтому сервер
 * узнаёт о ней только из этих событий: браузер присылает каждое изменение
 * вместе со всем составом корзины после него.
 *
 * cart_id — случайный id, который браузер хранит рядом с корзиной: одна
 * строка в админке — один браузер. Состав и цены пришли от браузера и могли
 * быть подделаны; заказ (order_id) сервер проверяет перед записью.
 */
export const cartEvents = pgTable(
  "cart_events",
  {
    id: text("id").primaryKey(),
    cartId: text("cart_id").notNull(),
    // Если посетитель вошёл в кабинет. Удалили аккаунт — запись обезличена.
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    action: text("action", { enum: CART_EVENT_ACTIONS }).notNull(),
    changes: jsonb("changes").$type<CartEventChange[]>().notNull(),
    // Вся корзина после изменения
    items: jsonb("items").$type<CartEventItem[]>().notNull(),
    // Заказ или заявка, которыми закончилось событие order
    orderId: text("order_id").references(() => productOrders.id, {
      onDelete: "set null",
    }),
    ip: text("ip"),
    // Город, провайдер, устройство, страница: всё, что известно по запросу
    visitor: jsonb("visitor").$type<VisitorInfo>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("cart_events_cart_created_idx").on(table.cartId, table.createdAt),
    index("cart_events_created_idx").on(table.createdAt),
    index("cart_events_user_id_idx").on(table.userId),
    index("cart_events_order_id_idx").on(table.orderId),
  ],
);
