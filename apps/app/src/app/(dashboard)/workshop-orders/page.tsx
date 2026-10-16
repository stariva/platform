import { Button, buttonVariants, Input } from "@stariva/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { SiteHeader } from "~/components/layout";
import { WorkshopBriefBulk } from "~/components/workshops/workshop-brief-button";
import {
  WORKSHOP_ORDER_STATUS_LABELS,
  WorkshopOrdersTable,
} from "~/components/workshops/workshop-orders-table";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const STATUSES = ["paid", "pending", "canceled", "refunded"] as const;
type Status = (typeof STATUSES)[number] | "all";

const querySchema = z.string().trim().max(100);
const workshopSchema = z.string().trim().min(1).max(200);
const statusSchema = z.enum([...STATUSES, "all"]);
const pageSchema = z.coerce
  .number()
  .finite()
  .transform((value) => Math.max(1, Math.floor(value)))
  .refine((value) => Number.isSafeInteger((value - 1) * PAGE_SIZE));

const first = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

interface Filters {
  workshop?: string;
  status: Status;
  query: string;
}

function pageHref({ workshop, status, query }: Filters, page = 1) {
  const params = new URLSearchParams();
  if (workshop) params.set("workshop", workshop);
  if (status !== "paid") params.set("status", status);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/workshop-orders?${search}` : "/workshop-orders";
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

export default async function WorkshopOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    workshop?: string | string[];
    status?: string | string[];
    q?: string | string[];
    page?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const parsedWorkshop = workshopSchema.safeParse(first(params.workshop));
  const parsedStatus = statusSchema.safeParse(first(params.status));
  const parsedQuery = querySchema.safeParse(first(params.q));
  const parsedPage = pageSchema.safeParse(first(params.page));
  const filters: Filters = {
    workshop: parsedWorkshop.success ? parsedWorkshop.data : undefined,
    status: parsedStatus.success ? parsedStatus.data : "paid",
    query: parsedQuery.success ? parsedQuery.data : "",
  };
  const page = parsedPage.success ? parsedPage.data : 1;

  const { items, total, statusCounts, workshops } =
    await api.admin.workshops.orders({
      workshop: filters.workshop,
      status: filters.status,
      query: filters.query || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) redirect(pageHref(filters, pages));

  const allCount = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  // Курсы, где кому-то из оплативших ещё не уходил PDF-бриф
  const missingBriefs = workshops.filter(
    (workshop) =>
      workshop.briefMissing > 0 &&
      (!filters.workshop || workshop.slug === filters.workshop),
  );

  return (
    <>
      <SiteHeader title="Записи на мастер-классы" />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Записи на мастер-классы
          </h1>
          <p className="text-muted-foreground text-sm">
            Все, кто оформил заказ на мастер-класс, свежие сверху. «Предзаказ» —
            заказ оформлен до старта уроков.
          </p>
        </div>

        {missingBriefs.map((workshop) => (
          <WorkshopBriefBulk key={workshop.slug} workshop={workshop} />
        ))}

        {workshops.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <FilterLink
              href={pageHref({ ...filters, workshop: undefined })}
              active={!filters.workshop}
            >
              Все курсы
            </FilterLink>
            {workshops.map((workshop) => (
              <FilterLink
                key={workshop.slug}
                href={pageHref({ ...filters, workshop: workshop.slug })}
                active={filters.workshop === workshop.slug}
              >
                {workshop.title} · {workshop.paid}
              </FilterLink>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {STATUSES.map((status) => (
            <FilterLink
              key={status}
              href={pageHref({ ...filters, status })}
              active={filters.status === status}
            >
              {WORKSHOP_ORDER_STATUS_LABELS[status]} · {statusCounts[status]}
            </FilterLink>
          ))}
          <FilterLink
            href={pageHref({ ...filters, status: "all" })}
            active={filters.status === "all"}
          >
            Все · {allCount}
          </FilterLink>
        </div>

        <form action="/workshop-orders" className="flex max-w-md gap-2">
          {filters.workshop && (
            <input type="hidden" name="workshop" value={filters.workshop} />
          )}
          {filters.status !== "paid" && (
            <input type="hidden" name="status" value={filters.status} />
          )}
          <Input
            type="search"
            name="q"
            defaultValue={filters.query}
            placeholder="Имя, почта или номер заказа"
            aria-label="Поиск по записям"
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

        <WorkshopOrdersTable rows={items} showWorkshop={!filters.workshop} />

        {pages > 1 && (
          <nav className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Страница {page} из {pages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={pageHref(filters, page - 1)}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Назад
                </Link>
              )}
              {page < pages && (
                <Link
                  href={pageHref(filters, page + 1)}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Вперёд
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </>
  );
}
