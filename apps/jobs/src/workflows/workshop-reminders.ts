import { hatchet } from "../client";
import { postToStorefront } from "../lib/storefront";

interface ReminderSweepResult {
  checked?: number;
  delivered?: number;
  failed?: number;
}

/**
 * Напоминания покупателям мастер-классов — каждые 15 минут.
 *
 * Сама рассылка живёт на сайте (письма, Telegram, ссылки входа), воркер
 * только дёргает её по расписанию: POST /api/workshops/reminders. Повторы
 * безопасны: сайт помнит, что уже отправлено, поэтому ретраи Hatchet
 * ничего не задвоят.
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
  fn: async () => {
    const body = await postToStorefront<ReminderSweepResult>(
      "/api/workshops/reminders",
      { timeoutMs: 110_000 },
    );
    return {
      checked: body.checked ?? 0,
      delivered: body.delivered ?? 0,
      failed: body.failed ?? 0,
    };
  },
});
