/** Напоминания о старте предзаказа: за неделю, за день и в момент старта. */
export type ReminderKind = "week" | "day" | "release";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/**
 * Окна отправки относительно старта: с `from` до `until`. Опоздавшее
 * напоминание не шлём — например, «до старта неделя» за два дня до старта.
 */
const WINDOWS: Record<ReminderKind, { from: number; until: number }> = {
  week: { from: -7 * DAY, until: -2 * DAY },
  day: { from: -1 * DAY, until: 0 },
  release: { from: 0, until: 2 * DAY },
};

export const REMINDER_KINDS = Object.keys(WINDOWS) as ReminderKind[];

/**
 * Какие напоминания пора отправить по заказу прямо сейчас. Напоминание
 * положено, только если заказ оплачен раньше его срока: купившему за три дня
 * до старта письмо «до старта неделя» не нужно — всё было в письме о покупке.
 */
export function dueReminders({
  releaseAt,
  paidAt,
  now,
}: {
  releaseAt: Date;
  paidAt: Date;
  now: Date;
}): ReminderKind[] {
  const start = releaseAt.getTime();
  return REMINDER_KINDS.filter((kind) => {
    const window = WINDOWS[kind];
    const from = start + window.from;
    return (
      paidAt.getTime() < from &&
      now.getTime() >= from &&
      now.getTime() < start + window.until
    );
  });
}

/** Сколько назад и вперёд от «сейчас» искать курсы со стартом для напоминаний. */
export const REMINDER_LOOKAHEAD_MS = 7 * DAY + HOUR;
export const REMINDER_LOOKBEHIND_MS = 2 * DAY;
