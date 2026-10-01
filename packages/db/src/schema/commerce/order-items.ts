import { bigint, integer, pgTable, text } from "drizzle-orm/pg-core";
import { productOrders } from "./orders";

/** Позиция в заказе на товары — снапшот цены/названия на момент покупки. */
export const productOrderItems = pgTable("product_order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => productOrders.id, { onDelete: "cascade" }),
  productSlug: text("product_slug").notNull(),
  // SKU Ozon (fbs_sku или fbo_sku в зависимости от схемы), нужен для
  // v2/delivery/checkout и v2/order/create. SKU Ozon больше 2^31 — нужен bigint
  ozonSku: bigint("ozon_sku", { mode: "number" }).notNull(),
  name: text("name").notNull(),
  // Цена за единицу в копейках на момент заказа
  price: integer("price").notNull(),
  quantity: integer("quantity").notNull().default(1),
});
