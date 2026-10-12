import { ORPCError } from "@orpc/server";
import {
  eq,
  productOrderItems,
  productOrderPayments,
  productOrders,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { loadItemProducts } from "./item-products";
import { toAdminOrder } from "./shape";

/** Один заказ со всеми позициями, фото изделий, доставкой и попытками оплаты. */
export const byId = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [order] = await context.db
      .select()
      .from(productOrders)
      .where(eq(productOrders.id, input.id));
    if (!order)
      throw new ORPCError("NOT_FOUND", { message: "Заказ не найден" });

    const [items, payments] = await Promise.all([
      context.db
        .select()
        .from(productOrderItems)
        .where(eq(productOrderItems.orderId, order.id)),
      context.db
        .select()
        .from(productOrderPayments)
        .where(eq(productOrderPayments.orderId, order.id)),
    ]);
    const products = await loadItemProducts(
      context.db,
      items.map((item) => item.productSlug),
    );
    return toAdminOrder(order, items, payments, products);
  });
