import { Button, buttonVariants, Input } from "@stariva/ui";
import Link from "next/link";
import { z } from "zod";
import { todayInMoscow } from "./crm-meta";

export const PRESETS = {
  month: "Этот месяц",
  prev: "Прошлый месяц",
  "30d": "30 дней",
  "90d": "90 дней",
  year: "Этот год",
  all: "Всё время",
} as const;
export type Preset = keyof typeof PRESETS;

const daySchema = z.iso.date();
const presetSchema = z.enum(Object.keys(PRESETS) as [Preset, ...Preset[]]);

export const first = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const shiftDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

/** Границы готового периода по Москве; to — включительно. */
export function presetRange(preset: Preset, today: string) {
  const month = `${today.slice(0, 8)}01`;
  switch (preset) {
    case "month":
      return { from: month, to: today };
    case "prev": {
      const end = shiftDays(month, -1);
      return { from: `${end.slice(0, 8)}01`, to: end };
    }
    case "30d":
      return { from: shiftDays(today, -29), to: today };
    case "90d":
      return { from: shiftDays(today, -89), to: today };
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    default:
      return { from: undefined, to: undefined };
  }
}

export interface PeriodParams {
  period?: string | string[];
  from?: string | string[];
  to?: string | string[];
}

/**
 * Период из адреса: свои даты (?from=&to=) важнее готового (?period=),
 * без всего — этот месяц.
 */
export function resolvePeriod(params: PeriodParams) {
  const today = todayInMoscow();
  const customFrom = daySchema.safeParse(first(params.from));
  const customTo = daySchema.safeParse(first(params.to));
  const custom = customFrom.success || customTo.success;
  const parsedPreset = presetSchema.safeParse(first(params.period));
  const preset: Preset | null = custom
    ? null
    : parsedPreset.success
      ? parsedPreset.data
      : "month";
  const range = preset
    ? presetRange(preset, today)
    : {
        from: customFrom.success ? customFrom.data : undefined,
        to: customTo.success ? customTo.data : undefined,
      };
  if (!preset && range.from && range.to && range.from > range.to) {
    [range.from, range.to] = [range.to, range.from];
  }
  return { today, preset, range };
}

/** Кнопки готовых периодов и форма своих дат для страницы `basePath`. */
export function PeriodPicker({
  basePath,
  preset,
  range,
  today,
}: {
  basePath: string;
  preset: Preset | null;
  range: { from?: string; to?: string };
  today: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PRESETS) as Preset[]).map((key) => (
          <Link
            key={key}
            href={key === "month" ? basePath : `${basePath}?period=${key}`}
            aria-current={preset === key ? "page" : undefined}
            className={buttonVariants({
              variant: preset === key ? "default" : "outline",
              size: "sm",
            })}
          >
            {PRESETS[key]}
          </Link>
        ))}
      </div>
      <form action={basePath} className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">Свой период:</span>
        <Input
          type="date"
          name="from"
          defaultValue={range.from}
          max={today}
          aria-label="С какого дня"
          className="w-auto"
        />
        <span className="text-muted-foreground text-sm">—</span>
        <Input
          type="date"
          name="to"
          defaultValue={range.to}
          aria-label="По какой день"
          className="w-auto"
        />
        <Button type="submit" variant="outline" size="sm">
          Показать
        </Button>
      </form>
    </div>
  );
}
