import { bigint, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { productOrders } from "./orders";

/** Параметры изделия под заказ: размер, цвет, мерки и пожелания покупателя. */
export interface MadeToOrderItemOptions {
  size: string;
  color: string;
  /** Мерки в см; подписи сохраняются как в момент заказа. */
  measurements: { label: string; value: string }[];
  comment?: string;
}

/** Позиция в заказе на товары — снапшот цены/названия на момент покупки. */
export const productOrderItems = pgTable("product_order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => productOrders.id, { onDelete: "cascade" }),
  productSlug: text("product_slug").notNull(),
  // SKU Ozon (fbs_sku или fbo_sku в зависимости от схемы), нужен для
  // v2/delivery/checkout и v2/order/create. SKU Ozon больше 2^31 — нужен bigint.
  // У изделий под заказ SKU нет: они не проходят через Ozon.
  ozonSku: bigint("ozon_sku", { mode: "number" }),
  name: text("name").notNull(),
  // Цена за единицу в копейках на момент заказа
  price: integer("price").notNull(),
  quantity: integer("quantity").notNull().default(1),
  // Только для заказов под заказ
  options: jsonb("options").$type<MadeToOrderItemOptions>(),
});
