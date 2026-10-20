import {
  Badge,
  buttonVariants,
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
import { SiteHeader } from "~/components/layout";
import {
  AccessCodeCopy,
  AccessCodeIssue,
  AccessCodeRemove,
} from "~/components/workshops/access-codes";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const pageSchema = z.coerce
  .number()
  .finite()
  .transform((value) => Math.max(1, Math.floor(value)))
  .refine((value) => Number.isSafeInteger((value - 1) * PAGE_SIZE));

const first = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

function pageHref(page: number) {
  return page > 1 ? `/access-codes?page=${page}` : "/access-codes";
}

/**
 * Коды доступа для покупателей с Ярмарки Мастеров: ссылки в чате заказа
 * там запрещены, поэтому Ольга отправляет код, а покупатель вводит его на
 * stariva.ru/code.
 */
export default async function AccessCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  const parsedPage = pageSchema.safeParse(first(params.page));
  const page = parsedPage.success ? parsedPage.data : 1;

  const [{ items, total }, workshops] = await Promise.all([
    api.admin.workshops.accessCodes({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    api.admin.workshops.list(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) redirect(pageHref(pages));

  // Платные курсы, которые не в архиве, — их и продают на Ярмарке
  const sellable = workshops
    .filter((w) => w.price > 0 && w.status !== "archived")
    .map(({ slug, title, price }) => ({ slug, title, price }));

  return (
    <>
      <SiteHeader title="Коды с Ярмарки" />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Коды с Ярмарки Мастеров
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Купили мастер-класс на Ярмарке — выдайте код и вставьте сообщение в
            чат заказа. Покупатель вводит код на stariva.ru/code, получает
            письмо с уроками и PDF, а заказ появляется в «Записях» с меткой
            livemaster. Каждый код срабатывает один раз.
          </p>
          <Link
            href="/access-codes/pdf-page"
            className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-3`}
          >
            Страница с QR-кодом для PDF
          </Link>
        </div>

        <AccessCodeIssue workshops={sellable} />

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Код</TableHead>
                <TableHead>Мастер-класс</TableHead>
                <TableHead>Пометка</TableHead>
                <TableHead>Выдан</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead>
                  <span className="sr-only">Действия</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-muted-foreground py-8 text-center"
                  >
                    Кодов пока нет
                  </TableCell>
                </TableRow>
              )}
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="align-top font-mono whitespace-nowrap">
                    {row.code}
                  </TableCell>
                  <TableCell className="max-w-[260px] align-top text-sm whitespace-normal">
                    {row.workshopTitle ?? row.workshopSlug}
                  </TableCell>
                  <TableCell className="max-w-[220px] align-top text-sm whitespace-normal">
                    {row.note ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top text-sm whitespace-nowrap">
                    {dateFormat.format(row.createdAt)}
                  </TableCell>
                  <TableCell className="align-top text-sm">
                    {row.redeemedAt ? (
                      <>
                        <Badge>Активирован</Badge>
                        <div className="text-muted-foreground mt-1 text-xs whitespace-nowrap">
                          {dateFormat.format(row.redeemedAt)}
                        </div>
                        {row.orderId && (
                          <Link
                            href={`/workshop-orders?status=all&q=${encodeURIComponent(row.orderId)}`}
                            className="text-xs break-all hover:underline"
                          >
                            {row.redeemedEmail ?? "Заказ"}
                          </Link>
                        )}
                      </>
                    ) : (
                      <Badge variant="secondary">Ждёт активации</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    {rub.format(row.amount)}
                  </TableCell>
                  <TableCell className="align-top">
                    {!row.redeemedAt && (
                      <div className="flex justify-end gap-1">
                        <AccessCodeCopy code={row.code} />
                        <AccessCodeRemove id={row.id} code={row.code} />
                      </div>
                    )}
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
                  href={pageHref(page - 1)}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Назад
                </Link>
              )}
              {page < pages && (
                <Link
                  href={pageHref(page + 1)}
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
