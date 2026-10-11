import { Button, buttonVariants, Input } from "@stariva/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ChatsTable } from "~/components/chats/chats-table";
import { SiteHeader } from "~/components/layout";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const querySchema = z.string().trim().max(100);
const pageSchema = z.coerce
  .number()
  .finite()
  .transform((value) => Math.max(1, Math.floor(value)))
  .refine((value) => Number.isSafeInteger((value - 1) * PAGE_SIZE));

function pageHref(query: string, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/chats?${search}` : "/chats";
}

export default async function ChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const parsedQuery = querySchema.safeParse(Array.isArray(q) ? q[0] : q);
  const parsedPage = pageSchema.safeParse(
    Array.isArray(pageParam) ? pageParam[0] : pageParam,
  );
  const query = parsedQuery.success ? parsedQuery.data : "";
  const page = parsedPage.success ? parsedPage.data : 1;

  const { items, total } = await api.admin.chats.list({
    query: query || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) redirect(pageHref(query, pages));

  return (
    <>
      <SiteHeader title="Чат с Никой" />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Чат с Никой</h1>
          <p className="text-muted-foreground text-sm">
            {query ? `Найдено ${total}` : `${total} всего`}. Один диалог — одна
            вкладка браузера: после перезагрузки страницы чат начинается заново.
            Если посетитель вошёл в кабинет, видно, кто это.
          </p>
        </div>

        <form action="/chats" className="flex max-w-md gap-2">
          <Input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Поиск по тексту переписки"
            aria-label="Поиск по переписке"
          />
          <Button type="submit" variant="outline">
            Найти
          </Button>
          {query && (
            <Link
              href="/chats"
              className={buttonVariants({ variant: "ghost" })}
            >
              Сбросить
            </Link>
          )}
        </form>

        <ChatsTable rows={items} />

        {pages > 1 && (
          <nav className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Страница {page} из {pages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={pageHref(query, page - 1)}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Назад
                </Link>
              )}
              {page < pages && (
                <Link
                  href={pageHref(query, page + 1)}
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
