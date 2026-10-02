import {
  desc,
  eq,
  inArray,
  productOrderItems,
  productOrders,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { toAdminOrder } from "./shape";

/** Столько последних заказов хватит для ручной работы; старее — через БД. */
const ORDERS_LIMIT = 300;

/** Заказы покупателей, новые сверху, с позициями. Неоплаченные тоже видны — для разбора «зависших» оплат. */
export const list = adminProcedure
  .input(z.object({ kind: z.enum(["stock", "made_to_order"]).optional() }))
  .handler(async ({ context, input }) => {
    const orders = await context.db
      .select()
      .from(productOrders)
      .where(input.kind ? eq(productOrders.kind, input.kind) : undefined)
      .orderBy(desc(productOrders.createdAt))
      .limit(ORDERS_LIMIT);

    const items =
      orders.length === 0
        ? []
        : await context.db
            .select()
            .from(productOrderItems)
            .where(
              inArray(
                productOrderItems.orderId,
                orders.map((order) => order.id),
              ),
            );

    return orders.map((order) =>
      toAdminOrder(
        order,
        items.filter((item) => item.orderId === order.id),
      ),
    );
  });
