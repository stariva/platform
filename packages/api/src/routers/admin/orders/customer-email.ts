import { env, logger } from "@stariva/config";
import {
  type Database,
  eq,
  productOrderItems,
  productOrders,
  user,
} from "@stariva/db";
import { sendOrderStatusEmail } from "@stariva/emails";

/** Куда ведёт ссылка «Открыть заказ», если адрес витрины не задан. */
const DEFAULT_STOREFRONT_URL = "https://stariva.ru";

/**
 * Пишет покупателю о статусе, в который мастер только что перевёл заказ.
 * Статус уже сохранён, поэтому сбой письма не ломает действие мастера —
 * только попадает в лог. true — письмо ушло.
 */
export async function emailCustomer(
  db: Database,
  orderId: string,
): Promise<boolean> {
  try {
    const [row] = await db
      .select({ order: productOrders, accountEmail: user.email })
      .from(productOrders)
      .leftJoin(user, eq(user.id, productOrders.userId))
      .where(eq(productOrders.id, orderId));
    if (!row) return false;
    const items = await db
      .select({
        name: productOrderItems.name,
        quantity: productOrderItems.quantity,
      })
      .from(productOrderItems)
      .where(eq(productOrderItems.orderId, orderId));
    return await sendOrderStatusEmail({
      order: row.order,
      items,
      to: row.order.contactEmail ?? row.accountEmail,
      siteUrl: env.STOREFRONT_URL ?? DEFAULT_STOREFRONT_URL,
    });
  } catch (error) {
    logger.error("orders.customer_email.failed", error, { orderId });
    return false;
  }
}
