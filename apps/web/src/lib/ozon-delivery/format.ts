import type { PickupPoint, PickupPointPeriod } from "./types";

// Неделя с понедельника, как её привыкли видеть в расписании
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const dayMonth = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});

/** "YYYY-MM-DD" по локальному времени браузера */
export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function formatDayMonth(key: string): string {
  return dayMonth.format(parseDateKey(key));
}

/** «1–2 октября» или «30 сентября – 2 октября» */
export function formatDateRange(from: string, to: string): string {
  if (from === to) return formatDayMonth(from);
  if (from.slice(0, 7) === to.slice(0, 7)) {
    return `${parseDateKey(from).getDate()}–${formatDayMonth(to)}`;
  }
  return `${formatDayMonth(from)} – ${formatDayMonth(to)}`;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} м`;
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} км`;
  return `${Math.round(km)} км`;
}

export function formatRating(rating: number): string {
  return rating.toFixed(1).replace(".", ",");
}

function isRoundTheClock(periods: PickupPointPeriod[]): boolean {
  const [only] = periods;
  return (
    periods.length === 1 &&
    only?.open === "00:00" &&
    ["23:59", "24:00", "00:00"].includes(only.close)
  );
}

export function describePeriods(periods: PickupPointPeriod[]): string {
  if (periods.length === 0) return "выходной";
  if (isRoundTheClock(periods)) return "круглосуточно";
  return periods.map((p) => `${p.open}–${p.close}`).join(", ");
}

/** Короткая строка для списка: «Сегодня 10:00–21:00» */
export function todayHours(
  point: PickupPoint,
  now: Date = new Date(),
): string | undefined {
  const today = point.schedule.find((day) => day.date === localDateKey(now));
  if (!today) return undefined;
  if (isRoundTheClock(today.periods)) return "Круглосуточно";
  return `Сегодня ${describePeriods(today.periods)}`;
}

/**
 * Расписание на ближайшую неделю по дням недели с понедельника, дни
 * с одинаковыми часами склеены: «Пн–Пт 10:00–21:00», «Сб–Вс 10:00–18:00».
 */
export function weekSchedule(
  point: PickupPoint,
  now: Date = new Date(),
): { days: string; hours: string }[] {
  const todayKey = localDateKey(now);
  const byWeekday = new Map<number, string>();
  for (const day of point.schedule
    .filter((d) => d.date >= todayKey)
    .slice(0, 7)) {
    const weekday = (parseDateKey(day.date).getDay() + 6) % 7;
    byWeekday.set(weekday, describePeriods(day.periods));
  }
  if (byWeekday.size === 0) return [];

  const hours = [...byWeekday.values()];
  if (byWeekday.size === 7 && hours.every((h) => h === hours[0])) {
    return [{ days: "Ежедневно", hours: hours[0] ?? "" }];
  }

  const rows: { days: string; hours: string; last: number }[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    const value = byWeekday.get(weekday);
    if (value === undefined) continue;
    const previous = rows.at(-1);
    if (previous && previous.hours === value && previous.last === weekday - 1) {
      previous.last = weekday;
      continue;
    }
    rows.push({ days: WEEKDAYS[weekday] ?? "", hours: value, last: weekday });
  }
  return rows.map((row) => {
    const last = WEEKDAYS[row.last] ?? "";
    return {
      days: row.days === last ? row.days : `${row.days}–${last}`,
      hours: row.hours,
    };
  });
}

/** Предупреждение о ближайших нерабочих днях в пределах двух недель */
export function holidayNotice(
  point: PickupPoint,
  now: Date = new Date(),
): string | undefined {
  const todayKey = localDateKey(now);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 14);
  const horizonKey = localDateKey(horizon);

  const holiday = point.holidays
    .filter((h) => h.to >= todayKey && h.from <= horizonKey)
    .sort((a, b) => a.from.localeCompare(b.from))[0];
  if (!holiday) return undefined;

  if (holiday.from <= todayKey) {
    return `Временно не работает до ${formatDayMonth(holiday.to)} включительно`;
  }
  return `Не работает ${formatDateRange(holiday.from, holiday.to)}`;
}

export function pointKindLabel(point: PickupPoint): string {
  return point.kind === "postamat" ? "Постамат" : "Пункт выдачи";
}
