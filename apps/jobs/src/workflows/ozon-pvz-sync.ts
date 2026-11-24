import { OZON_PVZ_SYNC_TIMEOUTS } from "@stariva/web-api/contract";
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
  executionTimeout: OZON_PVZ_SYNC_TIMEOUTS.execution,
  fn: (_input, ctx) =>
    webApi.jobs.pvz.sync(undefined, {
      signal: ctx.abortController.signal,
      context: { timeout: OZON_PVZ_SYNC_TIMEOUTS.clientMs },
    }),
});
