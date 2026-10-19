import { hatchet } from "../client";
import { webApi } from "../lib/web-api";

/** Зависшие issuing требуют ручной сверки: воркер только просит отправить алерт. */
export const npdIssuingWatchWorkflow = hatchet.workflow({
  name: "npd-issuing-watch",
  on: { cron: "*/15 * * * *" },
});

npdIssuingWatchWorkflow.task({
  name: "alert-stale-npd-requests",
  retries: 3,
  executionTimeout: "120s",
  fn: () => webApi.jobs.npd.sweep(undefined, { context: { timeout: 110_000 } }),
});
