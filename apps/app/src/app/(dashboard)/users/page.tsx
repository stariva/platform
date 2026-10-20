import {
  Badge,
  Button,
  buttonVariants,
  cn,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import { IconArrowDown } from "@tabler/icons-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SiteHeader } from "~/components/layout";
import { UserAvatar } from "~/components/users/user-avatar";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const querySchema = z.string().trim().max(100);
const pageSchema = z.coerce
  .number()
  .finite()
  .transform((value) => Math.max(1, Math.floor(value)))
  .refine((value) => Number.isSafeInteger((value - 1) * PAGE_SIZE));

const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

/** Порядок в таблице; по умолчанию — свежие регистрации сверху. */
const sortSchema = z.enum(["created", "lastSignIn"]).catch("created");
type Sort = z.infer<typeof sortSchema>;

function pageHref(query: string, page: number, sort: Sort) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (sort !== "created") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/users?${search}` : "/users";
}

/** Заголовок колонки-ссылки: включает сортировку по ней, с первой страницы. */
function SortableHead({
  label,
  value,
  sort,
  query,
}: {
  label: string;
  value: Sort;
  sort: Sort;
  query: string;
}) {
  const active = sort === value;
  return (
    <TableHead aria-sort={active ? "descending" : undefined}>
      <Link
        href={pageHref(query, 1, value)}
        className={cn(
          "inline-flex items-center gap-1 hover:underline",
          active && "text-foreground font-semibold",
        )}
      >
        {label}
        {active && <IconArrowDown className="size-3.5" aria-hidden />}
      </Link>
    </TableHead>
  );
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    page?: string | string[];
    sort?: string | string[];
  }>;
}) {
  const { q, page: pageParam, sort: sortParam } = await searchParams;
  const parsedQuery = querySchema.safeParse(Array.isArray(q) ? q[0] : q);
  const parsedPage = pageSchema.safeParse(
    Array.isArray(pageParam) ? pageParam[0] : pageParam,
  );
  const query = parsedQuery.success ? parsedQuery.data : "";
  const page = parsedPage.success ? parsedPage.data : 1;
  const sort = sortSchema.parse(
    Array.isArray(sortParam) ? sortParam[0] : sortParam,
  );

  const { items, total } = await api.admin.users.list({
    query: query || undefined,
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) redirect(pageHref(query, pages, sort));

  return (
    <>
      <SiteHeader title="Пользователи" />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Пользователи
          </h1>
          <p className="text-muted-foreground text-sm">
            {query ? `Найдено ${total}` : `${total} всего`}
          </p>
        </div>

        <form action="/users" className="flex max-w-md gap-2">
          <Input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Поиск по имени, почте или логину"
            aria-label="Поиск по пользователям"
          />
          {sort !== "created" && (
            <input type="hidden" name="sort" value={sort} />
          )}
          <Button type="submit" variant="outline">
            Найти
          </Button>
          {query && (
            <Link
              href={pageHref("", 1, sort)}
              className={buttonVariants({ variant: "ghost" })}
            >
              Сбросить
            </Link>
          )}
        </form>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Пользователь</TableHead>
                <TableHead>Почта</TableHead>
                <TableHead className="text-right">Заказы</TableHead>
                <TableHead className="text-right">Курсы</TableHead>
                <SortableHead
                  label="Регистрация"
                  value="created"
                  sort={sort}
                  query={query}
                />
                <SortableHead
                  label="Последний вход"
                  value="lastSignIn"
                  sort={sort}
                  query={query}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground py-8 text-center"
                  >
                    Никого не найдено
                  </TableCell>
                </TableRow>
              )}
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar name={item.name} image={item.image} />
                      <div className="min-w-0">
                        <Link
                          href={`/users/${item.id}`}
                          className="font-medium hover:underline"
                        >
                          {item.name?.trim() || (
                            <span className="text-muted-foreground">
                              Без имени
                            </span>
                          )}
                        </Link>
                        {item.username && (
                          <div className="text-muted-foreground text-xs">
                            @{item.username}
                          </div>
                        )}
                      </div>
                      {item.isAdmin && <Badge>Админ</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.email}
                    {!item.emailVerified && (
                      <div className="text-muted-foreground text-xs">
                        не подтверждена
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {item.productOrdersCount + item.workshopOrdersCount}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {item.coursesCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {dateFormat.format(item.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {item.lastSignInAt
                      ? dateTimeFormat.format(item.lastSignInAt)
                      : "—"}
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
                  href={pageHref(query, page - 1, sort)}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Назад
                </Link>
              )}
              {page < pages && (
                <Link
                  href={pageHref(query, page + 1, sort)}
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
