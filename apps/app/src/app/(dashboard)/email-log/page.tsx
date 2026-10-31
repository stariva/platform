import { EMAIL_LOG_STATUSES, type EmailLogStatus } from "@stariva/db/schema";
import { Button, buttonVariants, Input } from "@stariva/ui";
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
import { providerLabel } from "~/components/email-log/email-meta";
import { EmailTable } from "~/components/email-log/email-table";
import { SiteHeader } from "~/components/layout";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const BASE = "/email-log";
const PAGE_SIZE = 50;

const STATUS_LABELS: Record<EmailLogStatus, string> = {
  sent: "Отправлены",
  failed: "Не ушли",
};

const querySchema = z.string().trim().max(100);
const statusSchema = z.enum(
  EMAIL_LOG_STATUSES as unknown as [EmailLogStatus, ...EmailLogStatus[]],
);
const pageSchema = z.coerce
  .number()
  .finite()
  .transform((value) => Math.max(1, Math.floor(value)))
  .refine((value) => Number.isSafeInteger((value - 1) * PAGE_SIZE));

interface Filters {
  period: Record<string, string>;
  status?: EmailLogStatus;
  query: string;
}

function pageHref({ period, status, query }: Filters, page = 1) {
  const params = new URLSearchParams(period);
  if (status) params.set("status", status);
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

/**
 * Журнал исходящих писем: кому и что отправил сайт, дошло ли до почтового
 * провайдера и через какого. Если основной провайдер отказал, видно, что
 * письмо ушло с запасного, и что именно ответил отказавший.
 */
export default async function EmailLogPage({
  searchParams,
}: {
  searchParams: Promise<
    PeriodParams & {
      status?: string | string[];
      q?: string | string[];
      page?: string | string[];
    }
  >;
}) {
  const params = await searchParams;
  const { today, preset, range } = resolvePeriod(params);
  const parsedStatus = statusSchema.safeParse(first(params.status));
  const parsedQuery = querySchema.safeParse(first(params.q));
  const parsedPage = pageSchema.safeParse(first(params.page));
  const period: Record<string, string> = preset
    ? preset === "month"
      ? {}
      : { period: preset }
    : Object.fromEntries(
        Object.entries(range).filter(
          (entry): entry is [string, string] => !!entry[1],
        ),
      );
  const filters: Filters = {
    period,
    status: parsedStatus.success ? parsedStatus.data : undefined,
    query: parsedQuery.success ? parsedQuery.data : "",
  };
  const page = parsedPage.success ? parsedPage.data : 1;

  const { items, total, summary } = await api.admin.emailLog.list({
    ...range,
    status: filters.status,
    query: filters.query || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) redirect(pageHref(filters, pages));

  return (
    <>
      <SiteHeader title="Журнал писем" />
      <div className="space-y-6 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Журнал писем
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Все письма, которые отправил сайт: покупателям, с кодами входа и
            брифами. «Отправлено» значит, что почтовый провайдер принял письмо,
            а не что оно лежит во «Входящих»: если адрес не существует или ящик
            полон, провайдер узнает об этом позже. Письмо можно открыть и
            посмотреть, как его увидел адресат; у самых ранних записей журнала
            тела нет.
          </p>
        </div>

        <PeriodPicker
          basePath={BASE}
          preset={preset}
          range={range}
          today={today}
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Писем" value={summary.total} />
          <Stat
            label="Отправлено"
            value={summary.sent}
            hint={
              summary.providers
                .map((row) => `${providerLabel(row.provider)} ${row.sent}`)
                .join(" · ") || undefined
            }
          />
          <Stat
            label="Не ушло"
            value={summary.failed}
            tone={summary.failed > 0 ? "text-red-600" : undefined}
            hint="Ни один провайдер не принял письмо"
          />
          <Stat
            label="С запасного канала"
            value={summary.fallback}
            hint="Основной провайдер отказал, письмо ушло с запасного"
          />
        </div>

        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <FilterLink
              href={pageHref({ ...filters, status: undefined })}
              active={!filters.status}
            >
              Все · {summary.total}
            </FilterLink>
            <FilterLink
              href={pageHref({ ...filters, status: "sent" })}
              active={filters.status === "sent"}
            >
              {STATUS_LABELS.sent} · {summary.sent}
            </FilterLink>
            <FilterLink
              href={pageHref({ ...filters, status: "failed" })}
              active={filters.status === "failed"}
            >
              {STATUS_LABELS.failed} · {summary.failed}
            </FilterLink>
          </div>

          <form action={BASE} className="flex max-w-md gap-2">
            {Object.entries(filters.period).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            {filters.status && (
              <input type="hidden" name="status" value={filters.status} />
            )}
            <Input
              type="search"
              name="q"
              defaultValue={filters.query}
              placeholder="Почта, тема, номер заказа или текст ошибки"
              aria-label="Поиск по письмам"
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

          {filters.query && (
            <p className="text-muted-foreground text-sm">Найдено {total}</p>
          )}

          <EmailTable rows={items} />

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
