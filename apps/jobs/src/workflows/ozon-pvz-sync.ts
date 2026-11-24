import { hatchet } from "../client";
import { webApi } from "../lib/web-api";

/**
 * Синхронизация списка ПВЗ Ozon Доставки в локальную БД — раз в час.
 * При сбое Ozon API данные остаются в кэше. Повторы безопасны: upsert.
 */
export const ozonPvzSyncWorkflow = hatchet.workflow({
  name: "ozon-pvz-sync",
  on: { cron: "5 * * * *" },
});

ozonPvzSyncWorkflow.task({
  name: "sync-ozon-pvz",
  retries: 2,
  executionTimeout: "120s",
  fn: () => webApi.jobs.pvz.sync(undefined, { context: { timeout: 100_000 } }),
});
