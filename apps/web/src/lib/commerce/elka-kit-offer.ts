import { db } from "@stariva/db";
import { orders } from "@stariva/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { ELKA_WORKSHOP_SLUG } from "./elka-kit-price";

/** Покупка набора создаёт нулевой заказ курса, он не даёт скидку на ещё один набор. */
export async function hasPurchasedElkaWorkshop(
  userId: string,
): Promise<boolean> {
  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        eq(orders.workshopSlug, ELKA_WORKSHOP_SLUG),
        eq(orders.status, "paid"),
        gt(orders.amount, 0),
      ),
    )
    .limit(1);
  return Boolean(order);
}
