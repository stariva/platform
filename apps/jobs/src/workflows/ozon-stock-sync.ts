import { hatchet } from "../client";
import { webApi } from "../lib/web-api";

/**
 * Остаток товаров, которые продаются и на маркетплейсе Ozon, — каждые
 * 10 минут. Покупка на Ozon уменьшает остаток только на складе Ozon; сайт
 * (jobs.ozon.syncStock) подтягивает его к себе, чтобы не продать лишнего.
 * Повторы безопасны: сверка только опускает остаток до значения Ozon.
 */
export const ozonStockSyncWorkflow = hatchet.workflow({
  name: "ozon-stock-sync",
  on: {
    cron: "*/10 * * * *",
  },
});

ozonStockSyncWorkflow.task({
  name: "pull-ozon-stock",
  retries: 2,
  executionTimeout: "60s",
  fn: () =>
    webApi.jobs.ozon.syncStock(undefined, { context: { timeout: 50_000 } }),
});
