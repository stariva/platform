import { hatchet } from "../client";
import { webApi } from "../lib/web-api";

/**
 * Раз в сутки чистит закрытый бакет от файлов мастер-классов, на которые
 * больше никто не ссылается: заменённые видео, их HLS-нарезки, заменённые
 * PDF. Что удалять, решает сайт (jobs.storage.sweep); свежие файлы он не
 * трогает, поэтому повтор после сбоя безопасен.
 */
export const workshopStorageSweepWorkflow = hatchet.workflow({
  name: "workshop-storage-sweep",
  on: { cron: "30 1 * * *" },
});

workshopStorageSweepWorkflow.task({
  name: "delete-unused-workshop-files",
  retries: 3,
  executionTimeout: "300s",
  fn: () =>
    webApi.jobs.storage.sweep(undefined, { context: { timeout: 290_000 } }),
});
