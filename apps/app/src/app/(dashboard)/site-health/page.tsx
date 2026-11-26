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

const BASE = "/site-health";
const PAGE_SIZE = 50;

const FILTERS = ["issues", "all", "critical", "warning", "failed"] as const;
const FILTER_LABELS: Record<(typeof FILTERS)[number], string> = {
  issues: "С проблемами",
  all: "Все",
  critical: "Критичные",
  warning: "Предупреждения",
  failed: "Не загрузились",
};

const SORTS = ["worst", "url", "recent"] as const;
const SORT_LABELS: Record<(typeof SORTS)[number], string> = {
  worst: "Худшие первыми",
  url: "По адресу",
  recent: "Недавние",
};

const filterSchema = z.enum(FILTERS);
const sortSchema = z.enum(SORTS);
const querySchema = z.string().trim().max(200);
const pageSchema = z.coerce
  .number()
  .finite()
  .transform((value) => Math.max(1, Math.floor(value)))
  .refine((value) => Number.isSafeInteger((value - 1) * PAGE_SIZE));

type SiteHealthItem = Awaited<
  ReturnType<typeof api.admin.siteHealth.list>
>["items"][number];

interface Filters {
  filter: (typeof FILTERS)[number];
  sort: (typeof SORTS)[number];
  query: string;
}

function pageHref({ filter, sort, query }: Filters, page = 1) {
  const params = new URLSearchParams();
  if (filter !== "issues") params.set("filter", filter);
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

function pathOf(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function ms(value: number | null) {
  if (value == null) return "—";
  return value >= 1000
    ? `${(value / 1000).toFixed(1)} с`
    : `${Math.round(value)} мс`;
}

function severityClass(severity: "critical" | "warning" | "notice") {
  if (severity === "critical") return "text-red-600 dark:text-red-400";
  if (severity === "warning") return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function severityLabel(severity: "critical" | "warning" | "notice") {
  if (severity === "critical") return "критично";
  if (severity === "warning") return "важно";
  return "заметка";
}

function StatusBadge({ row }: { row: SiteHealthItem }) {
  if (row.status == null) {
    return <Badge variant="destructive">нет</Badge>;
  }
  if (row.status >= 400) {
    return <Badge variant="destructive">{row.status}</Badge>;
  }
  if ((row.redirectCount ?? 0) > 0) {
    return <Badge variant="secondary">{row.status} ↪</Badge>;
  }
  return <Badge variant="outline">{row.status}</Badge>;
}

function Count({ value, tone }: { value: number; tone: string }) {
  return <span className={`font-medium tabular-nums ${tone}`}>{value}</span>;
}

function ReportRow({ row }: { row: SiteHealthItem }) {
  const shownFindings = row.findings.slice(0, 2);
  return (
    <TableRow>
      <TableCell className="max-w-0 min-w-72">
        <div className="flex flex-col gap-1">
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
            <span className="truncate text-red-600 text-xs dark:text-red-400">
              {row.error}
            </span>
          )}
          {shownFindings.map((finding) => (
            <div
              key={finding.id}
              className="truncate text-xs"
              title={`${finding.message}${finding.target ? `: ${finding.target}` : ""}`}
            >
              <span className={severityClass(finding.severity)}>
                {severityLabel(finding.severity)}
              </span>{" "}
              <span className="text-muted-foreground">
                {finding.message}
                {finding.target && ` · ${pathOf(finding.target)}`}
              </span>
            </div>
          ))}
          {row.findingCount > shownFindings.length && (
            <span className="text-muted-foreground text-xs">
              ещё {row.findingCount - shownFindings.length}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <StatusBadge row={row} />
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <Count
          value={row.criticalCount}
          tone="text-red-600 dark:text-red-400"
        />{" "}
        <span className="text-muted-foreground">/</span>{" "}
        <Count
          value={row.warningCount}
          tone="text-amber-600 dark:text-amber-400"
        />{" "}
        <span className="text-muted-foreground">/</span>{" "}
        <Count value={row.noticeCount} tone="text-muted-foreground" />
      </TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {row.brokenLinks ?? "—"}/{row.internalLinks ?? "—"}
      </TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {row.brokenImages ?? "—"}/{row.images ?? "—"}
        {row.missingAltImages ? (
          <div className="text-xs">alt −{row.missingAltImages}</div>
        ) : null}
      </TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {ms(row.responseTimeMs)}
      </TableCell>
      <TableCell className="text-muted-foreground text-right whitespace-nowrap tabular-nums">
        {dateTime.format(row.scannedAt)}
      </TableCell>
    </TableRow>
  );
}

export default async function SiteHealthPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string | string[];
    sort?: string | string[];
    q?: string | string[];
    page?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const parsedFilter = filterSchema.safeParse(first(params.filter));
  const parsedSort = sortSchema.safeParse(first(params.sort));
  const parsedQuery = querySchema.safeParse(first(params.q));
  const parsedPage = pageSchema.safeParse(first(params.page));

  const filters: Filters = {
    filter: parsedFilter.success ? parsedFilter.data : "issues",
    sort: parsedSort.success ? parsedSort.data : "worst",
    query: parsedQuery.success ? parsedQuery.data : "",
  };
  const page = parsedPage.success ? parsedPage.data : 1;

  const [{ items, total }, summary] = await Promise.all([
    api.admin.siteHealth.list({
      filter: filters.filter,
      sort: filters.sort,
      query: filters.query || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    api.admin.siteHealth.summary(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) redirect(pageHref(filters, pages));

  return (
    <>
      <SiteHeader title="Здоровье сайта" />
      <div className="space-y-6 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Здоровье сайта
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Каждую ночь воркер проверяет страницы из sitemap.xml: HTTP-статус,
            редиректы, метаданные, canonical, schema.org, внутренние ссылки и
            изображения. Критичные проблемы первыми.
          </p>
        </div>

        {summary.pages === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed py-10 text-center text-sm">
            Проверок пока нет: прогон идёт каждую ночь и появится после первого
            запуска воркера site-health-scan.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Критичные страницы"
                value={summary.criticalPages}
                hint={`${summary.criticalFindings} критичных проблем · битых ссылок ${summary.brokenLinks} · изображений ${summary.brokenImages}`}
                tone="text-red-600 dark:text-red-400"
              />
              <Stat
                label="С предупреждениями"
                value={summary.warningPages}
                hint={`${summary.warningFindings} предупреждений · ${summary.noticeFindings} заметок`}
                tone="text-amber-600 dark:text-amber-400"
              />
              <Stat
                label="Чистые страницы"
                value={summary.cleanPages}
                hint={`Всего проверено ${summary.pages}`}
                tone="text-green-600 dark:text-green-400"
              />
              <Stat
                label="Не загрузились"
                value={summary.failed}
                hint="Ошибка HTTP, редирект или сеть"
                tone="text-red-600 dark:text-red-400"
              />
            </div>

            <section className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((filter) => (
                  <FilterLink
                    key={filter}
                    href={pageHref({ ...filters, filter })}
                    active={filters.filter === filter}
                  >
                    {FILTER_LABELS[filter]}
                  </FilterLink>
                ))}
              </div>

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
                {filters.filter !== "issues" && (
                  <input type="hidden" name="filter" value={filters.filter} />
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
                      <TableHead>Страница и проблемы</TableHead>
                      <TableHead className="text-right">HTTP</TableHead>
                      <TableHead className="text-right">Проблемы</TableHead>
                      <TableHead className="text-right">Ссылки</TableHead>
                      <TableHead className="text-right">Изображения</TableHead>
                      <TableHead className="text-right">Ответ</TableHead>
                      <TableHead className="text-right">Прогон</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
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
