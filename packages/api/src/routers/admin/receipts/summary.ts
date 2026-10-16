import {
  and,
  count,
  type Database,
  eq,
  inArray,
  orderReceipts,
  orders,
  productOrderPayments,
  productOrders,
  sql,
} from "@stariva/db";

/** Статусы, в которых чек уже не требуется: деньги не остались у продавца. */
const NO_RECEIPT_STATUSES = new Set(["canceled", "refunded"]);

/**
 * Сколько чеков должно быть у заказа на товары: по одному на каждую
 * поступившую оплату. Заказ под заказ платят дважды (предоплата и доплата),
 * готовое изделие — один раз.
 */
export function receiptsExpected(order: {
  kind: "stock" | "made_to_order";
  status: string;
  paidAt: Date | null;
  depositPaidAt: Date | null;
  /** Платежи ЮKassa в статусе succeeded (только у заказов под заказ). */
  succeededPayments: number;
}): number {
  if (NO_RECEIPT_STATUSES.has(order.status)) return 0;
  const paidOnce = order.paidAt || order.depositPaidAt ? 1 : 0;
  // Заказы без строк в платежах (оплачены до их появления) всё равно оплачены
  return order.kind === "made_to_order"
    ? Math.max(order.succeededPayments, paidOnce)
    : paidOnce;
}

/** Мастер-класс оплачивают один раз. */
export function workshopReceiptsExpected(status: string): number {
  return status === "paid" ? 1 : 0;
}

export interface ReceiptStats {
  /** Привязано чеков. */
  count: number;
  /** Из них не отправлено покупателю. */
  unsent: number;
  /** Успешных платежей по заказу. */
  succeededPayments: number;
}

const NONE: ReceiptStats = { count: 0, unsent: 0, succeededPayments: 0 };

/** Чеки и успешные оплаты заказов на товары — одним запросом на всю страницу. */
export async function loadProductReceiptStats(
  db: Database,
  orderIds: string[],
): Promise<Map<string, ReceiptStats>> {
  const stats = new Map<string, ReceiptStats>();
  if (orderIds.length === 0) return stats;
  const [receipts, payments] = await Promise.all([
    db
      .select({
        orderId: orderReceipts.productOrderId,
        total: count(),
        unsent: sql<number>`(count(*) filter (where ${orderReceipts.emailedAt} is null))::int`,
      })
      .from(orderReceipts)
      .where(inArray(orderReceipts.productOrderId, orderIds))
      .groupBy(orderReceipts.productOrderId),
    db
      .select({ orderId: productOrderPayments.orderId, total: count() })
      .from(productOrderPayments)
      .where(
        and(
          inArray(productOrderPayments.orderId, orderIds),
          eq(productOrderPayments.status, "succeeded"),
        ),
      )
      .groupBy(productOrderPayments.orderId),
  ]);
  for (const row of receipts) {
    if (!row.orderId) continue;
    stats.set(row.orderId, {
      ...NONE,
      count: row.total,
      unsent: row.unsent,
    });
  }
  for (const row of payments) {
    stats.set(row.orderId, {
      ...(stats.get(row.orderId) ?? NONE),
      succeededPayments: row.total,
    });
  }
  return stats;
}

/** Сколько чеков должно быть у одного заказа — для карточки заказа. */
export async function loadReceiptsExpected(
  db: Database,
  target: { kind: "product" | "workshop"; orderId: string },
): Promise<number> {
  if (target.kind === "workshop") {
    const [order] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, target.orderId));
    return order ? workshopReceiptsExpected(order.status) : 0;
  }
  const [[order], stats] = await Promise.all([
    db
      .select({
        kind: productOrders.kind,
        status: productOrders.status,
        paidAt: productOrders.paidAt,
        depositPaidAt: productOrders.depositPaidAt,
      })
      .from(productOrders)
      .where(eq(productOrders.id, target.orderId)),
    loadProductReceiptStats(db, [target.orderId]),
  ]);
  if (!order) return 0;
  return receiptsExpected({
    ...order,
    succeededPayments: stats.get(target.orderId)?.succeededPayments ?? 0,
  });
}
