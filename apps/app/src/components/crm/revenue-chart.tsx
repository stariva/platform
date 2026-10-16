"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@stariva/ui";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { rubles } from "./crm-meta";
import { CHANNEL_LABELS, type WorkChannel } from "./work-meta";

/**
 * Категориальная палитра: порядок фиксирован, проверена на различимость при
 * нарушениях цветового зрения в светлой и тёмной теме. Цвет получает
 * площадка по месту в годовой выручке; шестая и дальше — в «Другие».
 */
const SERIES = [
  { light: "#2a78d6", dark: "#3987e5" },
  { light: "#eb6834", dark: "#d95926" },
  { light: "#1baf7a", dark: "#199e70" },
  { light: "#eda100", dark: "#c98500" },
  { light: "#e87ba4", dark: "#d55181" },
];
const OTHER = { light: "#8a8984", dark: "#7b7a74" };

const MONTH = new Intl.DateTimeFormat("ru-RU", {
  month: "short",
  timeZone: "UTC",
});
const MONTH_LONG = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const compact = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export interface RevenueMonth {
  month: string;
  revenue: number;
  channels: Partial<Record<string, number>>;
}

/** Выручка по месяцам за год, столбики сложены по площадкам. */
export function RevenueChart({ months }: { months: RevenueMonth[] }) {
  const yearly = new Map<string, number>();
  for (const month of months) {
    for (const [channel, value] of Object.entries(month.channels)) {
      yearly.set(channel, (yearly.get(channel) ?? 0) + (value ?? 0));
    }
  }
  const ranked = [...yearly]
    .sort((a, b) => b[1] - a[1])
    .map(([channel]) => channel);
  const named = ranked.slice(0, SERIES.length);
  const hasOther = ranked.length > SERIES.length;
  const keys = [...named, ...(hasOther ? ["rest"] : [])];

  const config: ChartConfig = Object.fromEntries([
    ...named.map((channel, index) => [
      channel,
      {
        label: CHANNEL_LABELS[channel as WorkChannel] ?? channel,
        theme: SERIES[index] as { light: string; dark: string },
      },
    ]),
    ...(hasOther ? [["rest", { label: "Другие", theme: OTHER }]] : []),
  ]);

  const data = months.map((month) => {
    const row: Record<string, number | string> = {
      month: month.month,
      total: month.revenue,
    };
    // Нулей в данных нет: подсказка показывает только площадки с выручкой
    for (const key of named) {
      const value = month.channels[key];
      if (value) row[key] = value;
    }
    const rest = ranked
      .slice(SERIES.length)
      .reduce((sum, channel) => sum + (month.channels[channel] ?? 0), 0);
    if (rest > 0) row.rest = rest;
    return row;
  });

  if (keys.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        За год ещё не было оплат
      </p>
    );
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-[280px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value: string) =>
            MONTH.format(new Date(`${value}-01T00:00:00Z`))
          }
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(value: number) => compact.format(value)}
        />
        <ChartTooltip
          cursor={{ fillOpacity: 0.4 }}
          content={
            <ChartTooltipContent
              labelFormatter={(value) =>
                MONTH_LONG.format(new Date(`${value}-01T00:00:00Z`))
              }
              formatter={(value, name, item) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="size-2.5 shrink-0 rounded-[2px]"
                      style={{ background: item.color }}
                    />
                    <span className="text-muted-foreground">
                      {config[String(name)]?.label ?? name}
                    </span>
                  </span>
                  <span className="text-foreground font-mono font-medium tabular-nums">
                    {rubles.format(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <ChartLegend
          content={<ChartLegendContent />}
          itemSorter={(item) => keys.indexOf(String(item.dataKey))}
        />
        {keys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="revenue"
            fill={`var(--color-${key})`}
            stroke="var(--card)"
            strokeWidth={2}
            radius={index === keys.length - 1 ? [4, 4, 0, 0] : 0}
            maxBarSize={44}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
