import { logger } from "@stariva/config";
import { sendCampaignBatch } from "@stariva/emails";
import { siteUrl } from "@/lib/workshops/notifications";

// Сколько писем рассылок отправить за один прогон крона
const BATCH_SIZE = 100;
// Воркер ждёт ответа 110 с, а до рассылок успевают уйти напоминания: новое
// письмо после этого срока не начинаем, остаток — в следующий прогон
const TIME_BUDGET_MS = 60_000;

/**
 * Дошлёт рассылки из админки: письма, которые не ушли с первого раза, и
 * остаток, если отправку из админки прервали. Не ушедшее письмо — не ошибка
 * прогона: у получателя своя очередь повторов. Ошибкой прогон кончается,
 * только если рассылать нечем (нет провайдера, упала база): тогда Hatchet
 * повторит его, а повтор напоминаний безопасен.
 */
export async function runCampaignSweep(): Promise<void> {
  try {
    const result = await sendCampaignBatch({
      siteUrl: siteUrl(),
      limit: BATCH_SIZE,
      deadline: Date.now() + TIME_BUDGET_MS,
    });
    if (result.sent + result.failed + result.skipped > 0) {
      logger.info("email_campaign.sweep", { ...result });
    }
  } catch (error) {
    logger.error("email_campaign.sweep_failed", error);
    throw error;
  }
}
