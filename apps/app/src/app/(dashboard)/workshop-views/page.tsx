import { Button, buttonVariants, Input } from "@stariva/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { SiteHeader } from "~/components/layout";
import { WorkshopViewsTable } from "~/components/workshops/workshop-views-table";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const querySchema = z.string().trim().max(100);
const workshopSchema = z.string().trim().min(1).max(200);
const pageSchema = z.coerce
  .number()
  .finite()
  .transform((value) => Math.max(1, Math.floor(value)))
  .refine((value) => Number.isSafeInteger((value - 1) * PAGE_SIZE));

const first = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

interface Filters {
  workshop?: string;
  query: string;
}

function pageHref({ workshop, query }: Filters, page = 1) {
  const params = new URLSearchParams();
  if (workshop) params.set("workshop", workshop);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/workshop-views?${search}` : "/workshop-views";
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

export default async function WorkshopViewsPage({
  searchParams,
}: {
  searchParams: Promise<{
    workshop?: string | string[];
    q?: string | string[];
    page?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const parsedWorkshop = workshopSchema.safeParse(first(params.workshop));
  const parsedQuery = querySchema.safeParse(first(params.q));
  const parsedPage = pageSchema.safeParse(first(params.page));
  const filters: Filters = {
    workshop: parsedWorkshop.success ? parsedWorkshop.data : undefined,
    query: parsedQuery.success ? parsedQuery.data : "",
  };
  const page = parsedPage.success ? parsedPage.data : 1;

  const { items, total, workshops } = await api.admin.workshops.views({
    workshop: filters.workshop,
    query: filters.query || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) redirect(pageHref(filters, pages));

  return (
    <>
      <SiteHeader title="Просмотры мастер-классов" />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Просмотры мастер-классов
          </h1>
          <p className="text-muted-foreground text-sm">
            Кто и когда открывал уроки, свежие сверху. Строка — один урок за
            день; прогресс — докуда человек дошёл сейчас. Журнал хранится год.
          </p>
        </div>

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
                {workshop.title} · {workshop.accounts}
              </FilterLink>
            ))}
          </div>
        )}

        <form action="/workshop-views" className="flex max-w-md gap-2">
          {filters.workshop && (
            <input type="hidden" name="workshop" value={filters.workshop} />
          )}
          <Input
            type="search"
            name="q"
            defaultValue={filters.query}
            placeholder="Имя, почта или IP"
            aria-label="Поиск по просмотрам"
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

        <WorkshopViewsTable rows={items} showWorkshop={!filters.workshop} />

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
