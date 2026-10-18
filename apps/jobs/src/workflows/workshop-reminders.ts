import { hatchet } from "../client";
import { webApi } from "../lib/web-api";

/**
 * Напоминания покупателям мастер-классов — каждые 15 минут: о покупке, о
 * старте и «оплата не завершилась» тем, кто оформил заказ, но не оплатил.
 *
 * Сама рассылка живёт на сайте (письма, Telegram, ссылки входа), воркер
 * только дёргает её по расписанию: jobs.reminders.sweep. Если часть не ушла,
 * сайт отвечает ошибкой REMINDERS_FAILED и Hatchet повторяет задание. Повторы
 * безопасны: сайт помнит, что уже отправлено, и ничего не задвоит.
 */
export const workshopRemindersWorkflow = hatchet.workflow({
  name: "workshop-reminders",
  on: {
    cron: "*/15 * * * *",
  },
});

workshopRemindersWorkflow.task({
  name: "send-due-reminders",
  retries: 3,
  executionTimeout: "120s",
  fn: () =>
    webApi.jobs.reminders.sweep(undefined, { context: { timeout: 110_000 } }),
});
