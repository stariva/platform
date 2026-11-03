import { logger } from "@stariva/config";
import { sendCampaignBatch } from "@stariva/emails";
import { siteUrl } from "@/lib/workshops/notifications";

// Сколько писем рассылок отправить за один прогон крона
const BATCH_SIZE = 100;

/**
 * Дошлёт рассылки из админки: письма, которые не ушли с первого раза, и
 * остаток, если отправку из админки прервали. Сбои только логирует: у
 * получателя своя очередь повторов, и повтор всего прогона Hatchet ничего
 * не ускорит.
 */
export async function runCampaignSweep(): Promise<void> {
  try {
    const result = await sendCampaignBatch({
      siteUrl: siteUrl(),
      limit: BATCH_SIZE,
    });
    if (result.sent + result.failed + result.skipped > 0) {
      logger.info("email_campaign.sweep", { ...result });
    }
  } catch (error) {
    logger.error("email_campaign.sweep_failed", error);
  }
}
