import {
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
import { z } from "zod";
import { dateTime, rubles, sourceLabel } from "~/components/crm/crm-meta";
import { SourceBadge } from "~/components/crm/source-badge";
import { SiteHeader } from "~/components/layout";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const querySchema = z.string().trim().max(100);
const sourceSchema = z.string().trim().min(1).max(300);
const pageSchema = z.coerce
  .number()
  .finite()
  .transform((value) => Math.max(1, Math.floor(value)))
  .refine((value) => Number.isSafeInteger((value - 1) * PAGE_SIZE));

const first = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

interface Filters {
  query: string;
  source?: string;
  buyers: boolean;
}

/** Ссылка на страницу списка клиентов с сохранением поиска и фильтров. */
function pageHref({ query, source, buyers }: Filters, page = 1) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (source) params.set("source", source);
  if (buyers) params.set("buyers", "1");
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/crm/clients?${search}` : "/crm/clients";
}

/** Показывает клиентов с поиском, фильтрами и постраничной навигацией. */
export default async function CrmClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    source?: string | string[];
    buyers?: string | string[];
    page?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const parsedQuery = querySchema.safeParse(first(params.q));
  const parsedSource = sourceSchema.safeParse(first(params.source));
  const parsedPage = pageSchema.safeParse(first(params.page));
  const filters: Filters = {
    query: parsedQuery.success ? parsedQuery.data : "",
    source: parsedSource.success ? parsedSource.data : undefined,
    buyers: first(params.buyers) === "1",
  };
  const page = parsedPage.success ? parsedPage.data : 1;

  const { items, total, sources } = await api.admin.crm.clients({
    query: filters.query || undefined,
    source: filters.source,
    buyersOnly: filters.buyers,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) redirect(pageHref(filters, pages));

  return (
    <>
      <SiteHeader title="Клиенты" />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Клиенты</h1>
            <p className="text-muted-foreground max-w-3xl text-sm">
              Все, кто оформлял заказ, заявку или запись на сайте, — заказы с
              одним телефоном, почтой или аккаунтом собраны в одного клиента.
              Тех, кто написал в мессенджер или купил на Авито, добавьте вручную
              и укажите, с какой рекламы они пришли.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/crm/orders/new" className={buttonVariants()}>
              Индивидуальный заказ
            </Link>
            <Link
              href="/crm/clients/new"
              className={buttonVariants({ variant: "outline" })}
            >
              Добавить клиента
            </Link>
          </div>
        </div>

        <form
          action="/crm/clients"
          className="flex flex-wrap items-center gap-2"
        >
          <Input
            type="search"
            name="q"
            defaultValue={filters.query}
            placeholder="Имя, телефон или почта"
            aria-label="Поиск клиента"
            className="w-64"
          />
          <select
            name="source"
            defaultValue={filters.source ?? ""}
            aria-label="Источник"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            <option value="">Все источники</option>
            {sources.map((source) => (
              <option key={source.key} value={source.key}>
                {sourceLabel(source)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="buyers"
              value="1"
              defaultChecked={filters.buyers}
            />
            Только купившие
          </label>
          <Button type="submit" variant="outline">
            Показать
          </Button>
          {(filters.query || filters.source || filters.buyers) && (
            <Link
              href="/crm/clients"
              className={buttonVariants({ variant: "ghost" })}
            >
              Сбросить
            </Link>
          )}
          <span className="text-muted-foreground ml-auto text-sm">
            Найдено: {total}
          </span>
        </form>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Клиент</TableHead>
                <TableHead>Откуда</TableHead>
                <TableHead>Впервые</TableHead>
                <TableHead>Последний раз</TableHead>
                <TableHead className="text-right">Оплачено заказов</TableHead>
                <TableHead className="text-right">Принёс</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground py-8 text-center"
                  >
                    Клиентов не найдено
                  </TableCell>
                </TableRow>
              )}
              {items.map((client) => (
                <TableRow key={client.key}>
                  <TableCell className="max-w-[300px] align-top whitespace-normal">
                    <Link
                      href={`/crm/clients/${encodeURIComponent(client.key)}`}
                      className="font-medium hover:underline"
                    >
                      {client.name}
                    </Link>
                    <div className="text-muted-foreground text-xs break-all">
                      {[...client.phones.map((p) => `+${p}`), ...client.emails]
                        .slice(0, 3)
                        .join(" · ")}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[260px] align-top whitespace-normal">
                    <SourceBadge source={client.source} />
                  </TableCell>
                  <TableCell className="align-top text-sm whitespace-nowrap">
                    {dateTime.format(client.firstSeenAt)}
                  </TableCell>
                  <TableCell className="align-top text-sm whitespace-nowrap">
                    {dateTime.format(client.lastActivityAt)}
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    {client.paidDeals}
                    <span className="text-muted-foreground">
                      {" "}
                      из {client.deals}
                    </span>
                  </TableCell>
                  <TableCell className="text-right align-top font-medium tabular-nums">
                    {rubles.format(client.revenue)}
                  </TableCell>
                </TableRow>
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
