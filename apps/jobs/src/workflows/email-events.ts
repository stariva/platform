import { hatchet } from "../client";
import { webApi } from "../lib/web-api";

/**
 * Раз в минуту просит сайт дочитать поток событий Postbox: доставлено, не
 * доставлено, жалоба. Место в потоке хранит сайт, повтор безопасен. Пока
 * поток не настроен, сайт отвечает configured: false и ничего не делает.
 */
export const emailEventsWorkflow = hatchet.workflow({
  name: "email-events-sync",
  on: { cron: "* * * * *" },
});

emailEventsWorkflow.task({
  name: "sync-postbox-events",
  retries: 1,
  executionTimeout: "90s",
  fn: () =>
    webApi.jobs.emails.syncEvents(undefined, { context: { timeout: 80_000 } }),
});
