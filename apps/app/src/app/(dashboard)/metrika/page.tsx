import type {
  MetrikaGoalRow,
  MetrikaHitRow,
  MetrikaVisitRow,
} from "@stariva/db/schema";
import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import {
  first,
  type PeriodParams,
  PeriodPicker,
  resolvePeriod,
} from "~/components/crm/period";
import { Stat } from "~/components/crm/stat";
import { SiteHeader } from "~/components/layout";
import {
  MetrikaGoalsTable,
  MetrikaHitsTable,
  MetrikaVisitsTable,
} from "~/components/metrika";
import { deviceLabel, formatDuration } from "~/components/metrika/metrika-meta";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const BASE = "/metrika";
const PAGE_SIZE = 50;

const TABS = ["visits", "hits", "goals"] as const;
const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  visits: "Визиты",
  hits: "Просмотры и события",
  goals: "Цели",
};

const tabSchema = z.enum(TABS);
const querySchema = z.string().trim().max(100);
const pageSchema = z.coerce
  .number()
  .finite()
  .transform((value) => Math.max(1, Math.floor(value)))
  .refine((value) => Number.isSafeInteger((value - 1) * PAGE_SIZE));

interface Filters {
  period: Record<string, string>;
  tab: (typeof TABS)[number];
  query: string;
}

function pageHref({ period, tab, query }: Filters, page = 1) {
  const params = new URLSearchParams(period);
  if (tab !== "visits") params.set("tab", tab);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${BASE}?${search}` : BASE;
}

function tabHref(filters: Filters, tab: (typeof TABS)[number]) {
  return pageHref({ ...filters, tab }, 1);
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={buttonVariants({
        variant: active ? "default" : "outline",
        size: "sm",
      })}
    >
      {children}
    </Link>
  );
}

/**
 * Раздел «Метрика»: визиты, просмотры, цели и сводная аналитика по данным
 * Яндекс Метрики из таблиц metrika_*.
 */
export default async function MetrikaPage({
  searchParams,
}: {
  searchParams: Promise<
    PeriodParams & {
      tab?: string | string[];
      q?: string | string[];
      page?: string | string[];
    }
  >;
}) {
  const params = await searchParams;
  const { today, preset, range } = resolvePeriod(params, "30d");
  const parsedTab = tabSchema.safeParse(first(params.tab));
  const parsedQuery = querySchema.safeParse(first(params.q));
  const parsedPage = pageSchema.safeParse(first(params.page));

  const period: Record<string, string> = preset
    ? preset === "30d"
      ? {}
      : { period: preset }
    : Object.fromEntries(
        Object.entries(range).filter(
          (entry): entry is [string, string] => !!entry[1],
        ),
      );

  const filters: Filters = {
    period,
    tab: parsedTab.success ? parsedTab.data : "visits",
    query: parsedQuery.success ? parsedQuery.data : "",
  };
  const page = parsedPage.success ? parsedPage.data : 1;

  const summary = await api.admin.metrika.summary({
    from: range.from,
    to: range.to,
  });

  const listArgs = {
    query: filters.query || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  let total = 0;
  let table: ReactNode;

  switch (filters.tab) {
    case "hits": {
      const result = await api.admin.metrika.hits.list({
        ...listArgs,
        from: range.from,
        to: range.to,
      });
      total = result.total;
      table = <MetrikaHitsTable rows={result.items as MetrikaHitRow[]} />;
      break;
    }
    case "goals": {
      const result = await api.admin.metrika.goals.list(listArgs);
      total = result.total;
      table = <MetrikaGoalsTable rows={result.items as MetrikaGoalRow[]} />;
      break;
    }
    default: {
      const result = await api.admin.metrika.visits.list({
        ...listArgs,
        from: range.from,
        to: range.to,
      });
      total = result.total;
      table = <MetrikaVisitsTable rows={result.items as MetrikaVisitRow[]} />;
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) redirect(pageHref(filters, pages));

  const bounceRate =
    summary.visits.total > 0
      ? `${((summary.visits.bounces / summary.visits.total) * 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })}%`
      : "—";

  return (
    <>
      <SiteHeader title="Метрика" />
      <div className="space-y-6 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Метрика</h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Сырые данные Яндекс Метрики: визиты, просмотры страниц, события и
            цели. Связь с заказами — по ClientID из
            orders.visitor-&gt;ymClientId.
          </p>
        </div>

        <PeriodPicker
          basePath={BASE}
          preset={preset}
          range={range}
          today={today}
          fallback="30d"
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Визитов" value={summary.visits.total} />
          <Stat label="Просмотров / событий" value={summary.hits.total} />
          <Stat
            label="Уникальных посетителей"
            value={summary.visits.uniqueClients}
          />
          <Stat
            label="Средняя длительность"
            value={formatDuration(summary.visits.avgDurationSeconds)}
          />
          <Stat label="Отказов" value={bounceRate} />
          <Stat label="Новых посетителей" value={summary.visits.newUsers} />
          <Stat label="Достигнуто целей" value={summary.visits.withGoals} />
          <Stat
            label="Всего страниц"
            value={summary.visits.pageViews.toLocaleString("ru-RU")}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Источники трафика</CardTitle>
              <CardDescription>Последний значимый переход</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border contain-inline-size">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Источник</TableHead>
                      <TableHead className="text-right">Визитов</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.topSources.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-muted-foreground py-6 text-center"
                        >
                          Нет данных
                        </TableCell>
                      </TableRow>
                    )}
                    {summary.topSources.map((row) => (
                      <TableRow key={row.source ?? "unknown"}>
                        <TableCell className="text-sm">
                          {row.source ?? "Неизвестно"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {row.visits.toLocaleString("ru-RU")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Устройства</CardTitle>
              <CardDescription>По категории устройства</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border contain-inline-size">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Устройство</TableHead>
                      <TableHead className="text-right">Визитов</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.topDevices.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-muted-foreground py-6 text-center"
                        >
                          Нет данных
                        </TableCell>
                      </TableRow>
                    )}
                    {summary.topDevices.map((row) => (
                      <TableRow key={row.device ?? "unknown"}>
                        <TableCell className="text-sm">
                          {deviceLabel(row.device)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {row.visits.toLocaleString("ru-RU")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Города</CardTitle>
              <CardDescription>Топ городов по визитам</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border contain-inline-size">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Город</TableHead>
                      <TableHead className="text-right">Визитов</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.topCities.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-muted-foreground py-6 text-center"
                        >
                          Нет данных
                        </TableCell>
                      </TableRow>
                    )}
                    {summary.topCities.map((row) => (
                      <TableRow key={row.city ?? "unknown"}>
                        <TableCell className="text-sm">
                          {row.city ?? "Неизвестно"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {row.visits.toLocaleString("ru-RU")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Популярные страницы</CardTitle>
              <CardDescription>Топ просмотров страниц</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border contain-inline-size">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Страница</TableHead>
                      <TableHead className="text-right">Просмотров</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.topPages.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-muted-foreground py-6 text-center"
                        >
                          Нет данных
                        </TableCell>
                      </TableRow>
                    )}
                    {summary.topPages.map((row) => (
                      <TableRow key={row.url ?? "unknown"}>
                        <TableCell className="max-w-[300px] truncate text-sm">
                          <div
                            className="truncate"
                            title={row.url ?? undefined}
                          >
                            {row.url ?? "—"}
                          </div>
                          {row.title && (
                            <div className="text-muted-foreground truncate text-xs">
                              {row.title}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {row.hits.toLocaleString("ru-RU")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <TabLink
                key={tab}
                href={tabHref(filters, tab)}
                active={filters.tab === tab}
              >
                {TAB_LABELS[tab]}
              </TabLink>
            ))}
          </div>

          <form action={BASE} className="flex max-w-md gap-2">
            {Object.entries(filters.period).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <input type="hidden" name="tab" value={filters.tab} />
            <Input
              type="search"
              name="q"
              defaultValue={filters.query}
              placeholder="Поиск по таблице"
              aria-label="Поиск по таблице"
            />
            <Button type="submit" variant="outline">
              Найти
            </Button>
            {filters.query && (
              <Link
                href={tabHref({ ...filters, query: "" }, filters.tab)}
                className={buttonVariants({ variant: "ghost" })}
              >
                Сбросить
              </Link>
            )}
          </form>

          {filters.query && (
            <p className="text-muted-foreground text-sm">Найдено {total}</p>
          )}

          {table}

          {pages > 1 && (
            <nav className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Страница {page} из {pages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={pageHref(filters, page - 1)}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Назад
                  </Link>
                )}
                {page < pages && (
                  <Link
                    href={pageHref(filters, page + 1)}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Вперёд
                  </Link>
                )}
              </div>
            </nav>
          )}
        </section>
      </div>
    </>
  );
}
