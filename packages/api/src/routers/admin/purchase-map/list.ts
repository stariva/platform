import {
  and,
  gte,
  inArray,
  lt,
  productOrders,
  type SQL,
  sql,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { moscowDay } from "../crm/model";
import { daySchema } from "../crm/report";
import { type PurchaseRow, placesOf } from "./model";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Статусы, в которых заказ с сайта уже куплен: оплачен целиком или, для
 * изделия под заказ, внесена предоплата. Возврат, отмена, отказ мастера
 * и неоплаченные заказы в карту не попадают.
 */
const BOUGHT = [
  "paid",
  "fulfilling",
  "shipped",
  "delivered",
  "ozon_order_failed",
  "in_production",
  "awaiting_balance",
  "ready_to_ship",
] as const;

/**
 * Города, где купили продукцию: заказы с сайта за период, сгруппированные по
 * городу доставки (а если доставка согласуется вручную — по городу покупателя
 * по IP), с числом заказов, покупателей и суммой. Период считается по дню
 * оплаты по Москве; `to` — последний день включительно.
 *
 * @example client.admin.purchaseMap.list({ from: "2026-10-01", to: "2026-10-31" })
 */
export const list = adminProcedure
  .input(
    z.object({
      from: daySchema.optional(),
      to: daySchema.optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    // Дата покупки: оплата, а у изделия под заказ — предоплата
    const boughtAt = sql`coalesce(${productOrders.paidAt}, ${productOrders.depositPaidAt}, ${productOrders.createdAt})`;
    const filters: SQL[] = [inArray(productOrders.status, [...BOUGHT])];
    if (input.from) filters.push(gte(boughtAt, moscowDay(input.from)));
    if (input.to) {
      filters.push(lt(boughtAt, new Date(moscowDay(input.to).getTime() + DAY)));
    }

    const rows = await context.db
      .select({
        amountTotal: productOrders.amountTotal,
        userId: productOrders.userId,
        contactPhone: productOrders.contactPhone,
        deliveryAddress: productOrders.deliveryAddress,
        visitor: productOrders.visitor,
      })
      .from(productOrders)
      .where(and(...filters));

    const { places, unplaced } = placesOf(rows satisfies PurchaseRow[]);
    return {
      places,
      unplaced,
      orders: rows.length,
      revenue: rows.reduce((sum, row) => sum + row.amountTotal, 0) / 100,
    };
  });
