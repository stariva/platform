import { db } from "@stariva/db";
import { npdIncomeRequests } from "@stariva/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { notifyStaffAlert } from "@/lib/commerce/order-notifications";

// Обычный запрос ФНС занимает секунды; через 15 минут нужна ручная проверка.
export const NPD_ISSUING_STALE_MS = 15 * 60_000;

/** Только уведомляет: неизвестный исход нельзя исправлять повторным income. */
export async function runNpdIssuingSweep(now = new Date()) {
  const requests = await db
    .select()
    .from(npdIncomeRequests)
    .where(
      and(
        eq(npdIncomeRequests.status, "issuing"),
        lt(
          npdIncomeRequests.updatedAt,
          new Date(now.getTime() - NPD_ISSUING_STALE_MS),
        ),
      ),
    );

  for (const request of requests) {
    await notifyStaffAlert(
      request.paymentId,
      {
        title: "Проверьте зависший чек в «Мой налог»",
        message: `Заявка на чек по платежу ${request.paymentId} остаётся в статусе issuing с ${request.updatedAt.toISOString()}. Проверьте вручную платёж и чек в «Мой налог»: он мог выписаться. Если чек есть — привяжите его к заказу; если нет — сформируйте вручную. Сайт не повторяет запрос и не меняет статус заявки.`,
      },
      "npd-receipt-stale",
    );
  }
  return { checked: requests.length };
}
