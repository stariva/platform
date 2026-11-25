import type { PagespeedReportRow } from "@stariva/db/schema";
import {
  Badge,
  Button,
  buttonVariants,
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
import { dateTime } from "~/components/crm/crm-meta";
import { first } from "~/components/crm/period";
import { Stat } from "~/components/crm/stat";
import { SiteHeader } from "~/components/layout";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const BASE = "/pagespeed";
const PAGE_SIZE = 50;

const STRATEGIES = ["mobile", "desktop"] as const;
const STRATEGY_LABELS: Record<(typeof STRATEGIES)[number], string> = {
  mobile: "Мобильные",
  desktop: "Компьютер",
};

const SORTS = ["worst", "best", "url", "recent"] as const;
const SORT_LABELS: Record<(typeof SORTS)[number], string> = {
  worst: "Худшие первыми",
  best: "Лучшие первыми",
  url: "По адресу",
  recent: "Недавние",
};

const strategySchema = z.enum(STRATEGIES);
const sortSchema = z.enum(SORTS);
const querySchema = z.string().trim().max(200);
const pageSchema = z.coerce
  .number()
  .finite()
  .transform((value) => Math.max(1, Math.floor(value)))
  .refine((value) => Number.isSafeInteger((value - 1) * PAGE_SIZE));

interface Filters {
  strategy: (typeof STRATEGIES)[number];
  sort: (typeof SORTS)[number];
  query: string;
}

function pageHref({ strategy, sort, query }: Filters, page = 1) {
  const params = new URLSearchParams();
  if (strategy !== "mobile") params.set("strategy", strategy);
  if (sort !== "worst") params.set("sort", sort);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${BASE}?${search}` : BASE;
}

function FilterLink({
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

/** Цвет оценки Lighthouse: зелёный 90+, оранжевый 50–89, красный ниже 50. */
function scoreTone(score: number | null) {
  if (score == null) return "text-muted-foreground";
  if (score >= 90) return "text-green-600 dark:text-green-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function Score({ value }: { value: number | null }) {
  return (
    <span className={`font-medium tabular-nums ${scoreTone(value)}`}>
      {value ?? "—"}
    </span>
  );
}

function ms(value: number | null) {
  if (value == null) return "—";
  return value >= 1000
    ? `${(value / 1000).toFixed(1)} с`
    : `${Math.round(value)} мс`;
}

function pathOf(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function ReportRow({ row }: { row: PagespeedReportRow }) {
  return (
    <TableRow>
      <TableCell className="max-w-0">
        <div className="flex flex-col gap-0.5">
          <a
            href={row.url}
            target="_blank"
            rel="noreferrer"
            className="truncate font-medium hover:underline"
            title={row.url}
          >
            {pathOf(row.url)}
          </a>
          {row.error && (
            <span
              className="text-red-600 dark:text-red-400 truncate text-xs"
              title={row.error}
            >
              {row.error}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Score value={row.performance} />
      </TableCell>
      <TableCell className="text-right">
        <Score value={row.accessibility} />
      </TableCell>
      <TableCell className="text-right">
        <Score value={row.bestPractices} />
      </TableCell>
      <TableCell className="text-right">
        <Score value={row.seo} />
      </TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {ms(row.largestContentfulPaint)}
      </TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {row.cumulativeLayoutShift != null
          ? row.cumulativeLayoutShift.toFixed(2)
          : "—"}
      </TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {ms(row.totalBlockingTime)}
      </TableCell>
      <TableCell className="text-muted-foreground text-right whitespace-nowrap tabular-nums">
        {dateTime.format(row.scannedAt)}
      </TableCell>
    </TableRow>
  );
}

/**
 * Скорость страниц витрины: ежедневные оценки Google PageSpeed Insights по
 * каждой странице из sitemap.xml. Худшие первыми — это список работы:
 * над какими страницами стоит поработать в первую очередь.
 */
export default async function PagespeedPage({
  searchParams,
}: {
  searchParams: Promise<{
    strategy?: string | string[];
    sort?: string | string[];
    q?: string | string[];
    page?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const parsedStrategy = strategySchema.safeParse(first(params.strategy));
  const parsedSort = sortSchema.safeParse(first(params.sort));
  const parsedQuery = querySchema.safeParse(first(params.q));
  const parsedPage = pageSchema.safeParse(first(params.page));

  const filters: Filters = {
    strategy: parsedStrategy.success ? parsedStrategy.data : "mobile",
    sort: parsedSort.success ? parsedSort.data : "worst",
    query: parsedQuery.success ? parsedQuery.data : "",
  };
  const page = parsedPage.success ? parsedPage.data : 1;

  const [{ items, total }, summary] = await Promise.all([
    api.admin.pagespeed.list({
      strategy: filters.strategy,
      sort: filters.sort,
      query: filters.query || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    api.admin.pagespeed.summary({ strategy: filters.strategy }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) redirect(pageHref(filters, pages));

  return (
    <>
      <SiteHeader title="Скорость страниц" />
      <div className="space-y-6 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Скорость страниц
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Каждую ночь воркер прогоняет страницы из sitemap.xml витрины через
            Google PageSpeed Insights. Оценки 90+ — хорошо, 50–89 — стоит
            улучшить, ниже 50 — плохо. Худшие страницы первыми: с них и
            начинать.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {STRATEGIES.map((strategy) => (
            <FilterLink
              key={strategy}
              href={pageHref({ ...filters, strategy })}
              active={filters.strategy === strategy}
            >
              {STRATEGY_LABELS[strategy]}
            </FilterLink>
          ))}
        </div>

        {summary.pages === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed py-10 text-center text-sm">
            Оценок пока нет: прогон идёт каждую ночь и появится после первого
            запуска воркера. Проверьте, что в окружении воркера задан
            PAGESPEED_API_KEY.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Средняя производительность"
                value={
                  <span className={scoreTone(summary.avgPerformance)}>
                    {summary.avgPerformance ?? "—"}
                  </span>
                }
                hint={`SEO ${summary.avgSeo ?? "—"} · доступность ${summary.avgAccessibility ?? "—"} · практики ${summary.avgBestPractices ?? "—"}`}
              />
              <Stat
                label="Хороших страниц"
                value={summary.good}
                hint="Производительность 90 и выше"
                tone="text-green-600 dark:text-green-400"
              />
              <Stat
                label="Средних страниц"
                value={summary.average}
                hint="Производительность 50–89"
                tone="text-amber-600 dark:text-amber-400"
              />
              <Stat
                label="Плохих страниц"
                value={summary.poor}
                hint={
                  summary.failed > 0
                    ? `Ниже 50; ещё ${summary.failed} не просканировались`
                    : "Производительность ниже 50"
                }
                tone="text-red-600 dark:text-red-400"
              />
            </div>

            <section className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {SORTS.map((sort) => (
                  <FilterLink
                    key={sort}
                    href={pageHref({ ...filters, sort })}
                    active={filters.sort === sort}
                  >
                    {SORT_LABELS[sort]}
                  </FilterLink>
                ))}
              </div>

              <form action={BASE} className="flex max-w-md gap-2">
                {filters.strategy !== "mobile" && (
                  <input
                    type="hidden"
                    name="strategy"
                    value={filters.strategy}
                  />
                )}
                {filters.sort !== "worst" && (
                  <input type="hidden" name="sort" value={filters.sort} />
                )}
                <Input
                  type="search"
                  name="q"
                  defaultValue={filters.query}
                  placeholder="Адрес страницы"
                  aria-label="Поиск по адресу страницы"
                />
                <Button type="submit" variant="outline">
                  Найти
                </Button>
                {filters.query && (
                  <Link
                    href={pageHref({ ...filters, query: "" })}
                    className={buttonVariants({ variant: "ghost" })}
                  >
                    Сбросить
                  </Link>
                )}
              </form>

              {summary.lastScanAt && (
                <p className="text-muted-foreground text-sm">
                  Последний прогон {dateTime.format(summary.lastScanAt)}
                  {filters.query && ` · найдено ${total}`}
                </p>
              )}

              <div className="rounded-lg border contain-inline-size">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Страница</TableHead>
                      <TableHead className="text-right">
                        <Badge variant="outline">Скорость</Badge>
                      </TableHead>
                      <TableHead className="text-right">Доступн.</TableHead>
                      <TableHead className="text-right">Практики</TableHead>
                      <TableHead className="text-right">SEO</TableHead>
                      <TableHead className="text-right">LCP</TableHead>
                      <TableHead className="text-right">CLS</TableHead>
                      <TableHead className="text-right">TBT</TableHead>
                      <TableHead className="text-right">Прогон</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="text-muted-foreground py-8 text-center"
                        >
                          Страницы не найдены
                        </TableCell>
                      </TableRow>
                    )}
                    {items.map((row) => (
                      <ReportRow key={row.id} row={row} />
                    ))}
                  </TableBody>
                </Table>
              </div>

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
          </>
        )}
      </div>
    </>
  );
}
