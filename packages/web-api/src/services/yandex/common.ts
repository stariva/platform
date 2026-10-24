import { getTableColumns, sql } from "@stariva/db";

/** Дни выгрузки, YYYY-MM-DD по Москве, включительно. */
export interface DateRange {
  from: string;
  to: string;
}

// Счётчик и Директ считают дни по Москве; там нет перехода на летнее время.
const MOSCOW_OFFSET_MS = 3 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** Московская дата момента `at` со сдвигом на `days` дней. */
export function moscowDate(at: Date, days = 0): string {
  return new Date(at.getTime() + MOSCOW_OFFSET_MS + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * Последние `days` полных дней, по вчера включительно: за сегодня Logs API
 * данных не отдаёт, а статистика Директа ещё не закрыта.
 */
export function recentRange(days: number, now = new Date()): DateRange {
  return { from: moscowDate(now, -days), to: moscowDate(now, -1) };
}

/** «2026-10-20 14:03:05» по Москве (так пишет Logs API) — момент времени. */
export function moscowDateTime(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const at = new Date(`${match[1]}T${match[2]}+03:00`);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** `set` для onConflictDoUpdate: все колонки, кроме ключа, из новой строки. */
export function excludedColumns(
  table: Parameters<typeof getTableColumns>[0],
  key: string,
) {
  return Object.fromEntries(
    Object.entries(getTableColumns(table))
      .filter(([, column]) => column.name !== key)
      .map(([name, column]) => [name, sql.raw(`excluded."${column.name}"`)]),
  );
}

export function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    result.push(items.slice(i, i + size));
  return result;
}

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Короткий текст ответа API для ошибки: без токенов, только тело. */
export async function responseDetail(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  return text.slice(0, 500);
}
