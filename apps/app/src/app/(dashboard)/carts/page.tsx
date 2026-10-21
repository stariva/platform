import { Button, buttonVariants, Input } from "@stariva/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { CartsTable } from "~/components/carts/carts-table";
import { SiteHeader } from "~/components/layout";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const querySchema = z.string().trim().max(100);
const statusSchema = z.enum(["with_items", "ordered"]);
const pageSchema = z.coerce
  .number()
  .finite()
  .transform((value) => Math.max(1, Math.floor(value)))
  .refine((value) => Number.isSafeInteger((value - 1) * PAGE_SIZE));

const first = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

interface Filters {
  status?: z.infer<typeof statusSchema>;
  query: string;
}

function pageHref({ status, query }: Filters, page = 1) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/carts?${search}` : "/carts";
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

export default async function CartsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[];
    q?: string | string[];
    page?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const parsedStatus = statusSchema.safeParse(first(params.status));
  const parsedQuery = querySchema.safeParse(first(params.q));
  const parsedPage = pageSchema.safeParse(first(params.page));
  const filters: Filters = {
    status: parsedStatus.success ? parsedStatus.data : undefined,
    query: parsedQuery.success ? parsedQuery.data : "",
  };
  const page = parsedPage.success ? parsedPage.data : 1;

  const { items, total, summary } = await api.admin.carts.list({
    status: filters.status,
    query: filters.query || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) redirect(pageHref(filters, pages));

  return (
    <>
      <SiteHeader title="Корзины" />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Корзины</h1>
          <p className="text-muted-foreground text-sm">
            Одна строка — один браузер: что посетитель клал в корзину и чем
            кончилось. Имя видно, если он вошёл в кабинет или оформил заказ; про
            гостя известны только город, устройство и IP.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterLink
            href={pageHref({ query: filters.query })}
            active={!filters.status}
          >
            Все · {summary.carts}
          </FilterLink>
          <FilterLink
            href={pageHref({ status: "with_items", query: filters.query })}
            active={filters.status === "with_items"}
          >
            Есть товары · {summary.withItems}
          </FilterLink>
          <FilterLink
            href={pageHref({ status: "ordered", query: filters.query })}
            active={filters.status === "ordered"}
          >
            Оформили заказ · {summary.ordered}
          </FilterLink>
        </div>

        <form action="/carts" className="flex max-w-md gap-2">
          {filters.status && (
            <input type="hidden" name="status" value={filters.status} />
          )}
          <Input
            type="search"
            name="q"
            defaultValue={filters.query}
            placeholder="Товар, имя, почта, телефон или IP"
            aria-label="Поиск по корзинам"
          />
          <Button type="submit" variant="outline">
            Найти
          </Button>
          {filters.query && (
            <Link
              href={pageHref({ status: filters.status, query: "" })}
              className={buttonVariants({ variant: "ghost" })}
            >
              Сбросить
            </Link>
          )}
        </form>

        {filters.query && (
          <p className="text-muted-foreground text-sm">Найдено {total}</p>
        )}

        <CartsTable rows={items} />

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
