import {
  count,
  desc,
  eq,
  inArray,
  orderReceipts,
  productOrderItems,
  productOrders,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { loadItemProducts } from "./item-products";
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

    const orderIds = orders.map((order) => order.id);
    const [items, receipts] =
      orderIds.length === 0
        ? [[], []]
        : await Promise.all([
            context.db
              .select()
              .from(productOrderItems)
              .where(inArray(productOrderItems.orderId, orderIds)),
            context.db
              .select({
                orderId: orderReceipts.productOrderId,
                total: count(),
              })
              .from(orderReceipts)
              .where(inArray(orderReceipts.productOrderId, orderIds))
              .groupBy(orderReceipts.productOrderId),
          ]);
    const receiptCounts = new Map(
      receipts.map((row) => [row.orderId, row.total]),
    );

    const products = await loadItemProducts(
      context.db,
      items.map((item) => item.productSlug),
    );

    return orders.map((order) => ({
      ...toAdminOrder(
        order,
        items.filter((item) => item.orderId === order.id),
        [],
        products,
      ),
      // Сколько чеков привязано — список подсвечивает оплаченные без чека
      receiptCount: receiptCounts.get(order.id) ?? 0,
    }));
  });
