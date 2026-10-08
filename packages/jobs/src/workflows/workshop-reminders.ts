import { hatchet } from "../client";

/**
 * Напоминания покупателям мастер-классов — каждые 15 минут.
 *
 * Сама рассылка живёт на сайте (письма, Telegram, ссылки входа), воркер
 * только дёргает её по расписанию: POST {STOREFRONT_URL}/api/workshops/reminders
 * с общим секретом JOBS_SECRET. Повторы безопасны: сайт помнит, что уже
 * отправлено, поэтому ретраи Hatchet ничего не задвоят.
 *
 * Переменные воркера: HATCHET_CLIENT_TOKEN, STOREFRONT_URL, JOBS_SECRET.
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
    const storefront = process.env.STOREFRONT_URL?.replace(/\/$/, "");
    const secret = process.env.JOBS_SECRET;
    if (!storefront || !secret) {
      throw new Error("STOREFRONT_URL и JOBS_SECRET обязательны для воркера");
    }

    const res = await fetch(`${storefront}/api/workshops/reminders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(110_000),
    });
    const body = (await res.json().catch(() => ({}))) as {
      checked?: number;
      delivered?: number;
      failed?: number;
    };
    if (!res.ok) {
      throw new Error(
        `Рассылка напоминаний не удалась: HTTP ${res.status}, ${JSON.stringify(body)}`,
      );
    }
    return {
      checked: body.checked ?? 0,
      delivered: body.delivered ?? 0,
      failed: body.failed ?? 0,
    };
  },
});
