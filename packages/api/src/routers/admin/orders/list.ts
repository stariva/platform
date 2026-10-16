import {
  desc,
  eq,
  inArray,
  productOrderItems,
  productOrders,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { loadProductReceiptStats, receiptsExpected } from "../receipts/summary";
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
    const [items, receiptStats] = await Promise.all([
      orderIds.length === 0
        ? []
        : context.db
            .select()
            .from(productOrderItems)
            .where(inArray(productOrderItems.orderId, orderIds)),
      loadProductReceiptStats(context.db, orderIds),
    ]);

    const products = await loadItemProducts(
      context.db,
      items.map((item) => item.productSlug),
    );

    return orders.map((order) => {
      const stats = receiptStats.get(order.id);
      const succeededPayments = stats?.succeededPayments ?? 0;
      return {
        ...toAdminOrder(
          order,
          items.filter((item) => item.orderId === order.id),
          [],
          products,
        ),
        // Список подсвечивает заказы, где чеков меньше, чем оплат, и чеки,
        // которые не дошли до покупателя
        receiptCount: stats?.count ?? 0,
        receiptsExpected: receiptsExpected({ ...order, succeededPayments }),
        // Без адреса письмо слать некуда — такой чек мастер передаёт сама
        receiptsUnsent:
          order.contactEmail || order.userId ? (stats?.unsent ?? 0) : 0,
      };
    });
  });
