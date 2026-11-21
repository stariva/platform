import { ORPCError } from "@orpc/server";
import { type Database, eq, orders } from "@stariva/db";
import { z } from "zod";
import { adminProcedure } from "../../../orpc";
import { issueBoostyReceipt as issueOnStorefront } from "../../../storefront";

/** Оплаченный Boosty-заказ или причина, почему чек для него не выписать. */
export async function loadBoostyPaidOrder(
  db: Database,
  id: string,
): Promise<{ status: string; paymentId: string }> {
  const [order] = await db
    .select({ status: orders.status, paymentId: orders.paymentId })
    .from(orders)
    .where(eq(orders.id, id));
  if (!order?.paymentId?.startsWith("boosty:")) {
    throw new ORPCError("NOT_FOUND", { message: "Boosty-заказ не найден" });
  }
  if (order.status !== "paid") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Заказ ещё не оплачен — сначала сверьте оплату в Boosty",
    });
  }
  return { status: order.status, paymentId: order.paymentId };
}

/**
 * Формирует чек НПД по оплаченному Boosty-заказу — то же, что сайт делает
 * сам при оплате ЮKassa. Для старых заказов, активированных до автоматической
 * выписки, и когда «Мой налог» не ответил при активации. Повторный вызов
 * безопасен: чек на заказ выписывается один раз.
 *
 * @example client.admin.workshops.issueBoostyReceipt({ id })
 */
export const issueBoostyReceipt = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, input }) => {
    await loadBoostyPaidOrder(context.db, input.id);
    // false — витрина недоступна или не настроена: чек сформируют ссылкой
    return { issued: await issueOnStorefront(input.id) };
  });
