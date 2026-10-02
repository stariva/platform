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
import { SiteHeader } from "~/components/layout";
import { UserAvatar } from "~/components/users/user-avatar";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" });

function pageHref(query: string, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/users?${search}` : "/users";
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const query = (q ?? "").trim();
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);

  const { items, total } = await api.admin.users.list({
    query: query || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
          <Button type="submit" variant="outline">
            Найти
          </Button>
          {query && (
            <Link
              href="/users"
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
                <TableHead>Регистрация</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
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
                          {item.name}
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
