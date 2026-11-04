import {
  and,
  eq,
  gte,
  inArray,
  lt,
  orders,
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
 * Города, где купили: заказы товаров и оплаченные записи на мастер-классы за
 * период, сгруппированные по городу доставки (а если доставки нет или она
 * согласуется вручную — по городу покупателя по IP), с числом покупок,
 * покупателей и суммой. Возвращённые записи не считаются. Период считается по
 * дню оплаты по Москве; `to` — последний день включительно.
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
    const period = (at: SQL): SQL[] => {
      const filters: SQL[] = [];
      if (input.from) filters.push(gte(at, moscowDay(input.from)));
      if (input.to) {
        filters.push(lt(at, new Date(moscowDay(input.to).getTime() + DAY)));
      }
      return filters;
    };
    // Дата покупки: оплата, а у изделия под заказ — предоплата
    const boughtAt = sql`coalesce(${productOrders.paidAt}, ${productOrders.depositPaidAt}, ${productOrders.createdAt})`;
    const enrolledAt = sql`coalesce(${orders.paidAt}, ${orders.createdAt})`;

    const [productRows, workshopRows] = await Promise.all([
      context.db
        .select({
          amountTotal: productOrders.amountTotal,
          userId: productOrders.userId,
          contactPhone: productOrders.contactPhone,
          deliveryAddress: productOrders.deliveryAddress,
          visitor: productOrders.visitor,
        })
        .from(productOrders)
        .where(
          and(inArray(productOrders.status, [...BOUGHT]), ...period(boughtAt)),
        ),
      context.db
        .select({
          amountTotal: orders.amount,
          userId: orders.userId,
          visitor: orders.visitor,
        })
        .from(orders)
        .where(and(eq(orders.status, "paid"), ...period(enrolledAt))),
    ]);

    const rows: PurchaseRow[] = [
      ...productRows.map((row): PurchaseRow => ({ ...row, kind: "product" })),
      ...workshopRows.map(
        (row): PurchaseRow => ({
          ...row,
          kind: "workshop",
          contactPhone: "",
          deliveryAddress: null,
        }),
      ),
    ];

    const { places, unplaced } = placesOf(rows);
    return {
      places,
      unplaced,
      orders: rows.length,
      workshops: workshopRows.length,
      revenue: rows.reduce((sum, row) => sum + row.amountTotal, 0) / 100,
    };
  });
