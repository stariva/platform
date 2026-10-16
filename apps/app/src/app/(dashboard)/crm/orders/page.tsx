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
import { z } from "zod";
import { dateTime, rubles } from "~/components/crm/crm-meta";
import { first } from "~/components/crm/period";
import { Stat } from "~/components/crm/stat";
import {
  ACTIVE_STAGES,
  CHANNEL_LABELS,
  STAGE_HINTS,
  STAGE_LABELS,
  type Stage,
  statusLabel,
  TYPE_LABELS,
  type WorkChannel,
  type WorkType,
} from "~/components/crm/work-meta";
import {
  OrderBadges,
  OrderMoney,
  WorkOrderCard,
} from "~/components/crm/work-order-card";
import { SiteHeader } from "~/components/layout";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;
const BOARD_PAGE_SIZE = 500;

const STAGES = Object.keys(STAGE_LABELS) as [Stage, ...Stage[]];
const CHANNELS = Object.keys(CHANNEL_LABELS) as [WorkChannel, ...WorkChannel[]];
const TYPES = (Object.keys(TYPE_LABELS) as WorkType[]).filter(
  (type) => type !== "request",
) as [WorkType, ...WorkType[]];

const paramsSchema = z.object({
  view: z.enum(["board", "list"]).catch("board"),
  stage: z.enum(STAGES).optional().catch(undefined),
  channel: z.enum(CHANNELS).optional().catch(undefined),
  type: z.enum(TYPES).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
});
type Params = z.infer<typeof paramsSchema>;

/** Адрес страницы с фильтрами; пустые и умолчания не пишутся. */
function href(params: Partial<Params>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === null) continue;
    if (key === "view" && value === "board") continue;
    if (key === "page" && value === 1) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `/crm/orders?${query}` : "/crm/orders";
}

const selectClass =
  "border-input dark:bg-input/30 h-9 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

/** Фильтры: поиск, площадка, вид; в списке ещё этап и даты оформления. */
function Filters({ params }: { params: Params }) {
  const list = params.view === "list";
  return (
    <form action="/crm/orders" className="flex flex-wrap items-center gap-2">
      {list && <input type="hidden" name="view" value="list" />}
      <Input
        name="q"
        defaultValue={params.q}
        placeholder="Номер, клиент, телефон, изделие"
        aria-label="Поиск"
        className="w-64"
      />
      <select
        name="channel"
        defaultValue={params.channel ?? ""}
        aria-label="Площадка"
        className={selectClass}
      >
        <option value="">Все площадки</option>
        {CHANNELS.map((channel) => (
          <option key={channel} value={channel}>
            {CHANNEL_LABELS[channel]}
          </option>
        ))}
      </select>
      <select
        name="type"
        defaultValue={params.type ?? ""}
        aria-label="Вид заказа"
        className={selectClass}
      >
        <option value="">Все виды</option>
        {TYPES.map((type) => (
          <option key={type} value={type}>
            {TYPE_LABELS[type]}
          </option>
        ))}
      </select>
      {list && (
        <>
          <input type="hidden" name="stage" value={params.stage ?? ""} />
          <span className="text-muted-foreground text-sm">оформлен</span>
          <Input
            type="date"
            name="from"
            defaultValue={params.from}
            aria-label="Оформлен с"
            className="w-auto"
          />
          <span className="text-muted-foreground text-sm">—</span>
          <Input
            type="date"
            name="to"
            defaultValue={params.to}
            aria-label="Оформлен по"
            className="w-auto"
          />
        </>
      )}
      <Button type="submit" variant="outline" size="sm">
        Найти
      </Button>
      {(params.q ||
        params.channel ||
        params.type ||
        params.from ||
        params.to) && (
        <Link
          href={href({ view: params.view, stage: params.stage })}
          className="text-muted-foreground text-sm hover:underline"
        >
          Сбросить
        </Link>
      )}
    </form>
  );
}

/** Доска: колонки этапов в работе, в каждой — сначала просроченные. */
async function Board({ params }: { params: Params }) {
  const input = {
    view: "active" as const,
    channel: params.channel,
    type: params.type,
    query: params.q,
    limit: BOARD_PAGE_SIZE,
  };
  const { items, stages, kinds, total } = await api.admin.crm.orders(input);
  for (
    let offset = BOARD_PAGE_SIZE;
    offset < total;
    offset += BOARD_PAGE_SIZE
  ) {
    const page = await api.admin.crm.orders({ ...input, offset });
    items.push(...page.items);
  }
  const orders = kinds.reduce(
    (sum, row) => sum + (row.kind === "request" ? 0 : row.count),
    0,
  );
  const requests = kinds.find((row) => row.kind === "request")?.count ?? 0;
  const overdue = stages.reduce((sum, row) => sum + row.overdue, 0);
  const toCollect = stages.reduce((sum, row) => sum + row.toCollect, 0);
  const amount = stages.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Заказов в работе"
          value={orders}
          hint={`На сумму ${rubles.format(amount)}`}
        />
        <Stat
          label="Ещё придёт денег"
          value={rubles.format(toCollect)}
          hint="Доплаты и неоплаченные заказы в работе"
        />
        <Stat
          label="Просрочено"
          value={overdue}
          tone={overdue > 0 ? "text-destructive" : ""}
          hint="Прошёл срок или истекла ссылка на оплату"
        />
        <Stat
          label="Заявок без ответа"
          value={requests}
          hint="Свежие заявки с сайта, по которым ещё нет заказа"
        />
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:-mx-6 lg:px-6">
        <div className="grid min-w-[1100px] grid-cols-5 gap-3">
          {ACTIVE_STAGES.map((stage) => {
            const own = items.filter((order) => order.stage === stage);
            const total = stages.find((row) => row.stage === stage);
            return (
              <section
                key={stage}
                aria-label={STAGE_LABELS[stage]}
                className="bg-muted/40 space-y-2 rounded-lg p-2"
              >
                <header className="px-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold">
                      {STAGE_LABELS[stage]}
                    </h2>
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {own.length}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {STAGE_HINTS[stage]}
                    {total && total.amount > 0 && (
                      <> · {rubles.format(total.amount)}</>
                    )}
                  </p>
                </header>
                {own.length === 0 && (
                  <p className="text-muted-foreground px-1 py-4 text-center text-xs">
                    Пусто
                  </p>
                )}
                {own.map((order) => (
                  <WorkOrderCard
                    key={`${order.kind}:${order.id}`}
                    order={order}
                  />
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Список всех заказов с переключателем этапов и страницами. */
async function List({ params }: { params: Params }) {
  const { items, total, stages } = await api.admin.crm.orders({
    view: "all",
    stage: params.stage,
    channel: params.channel,
    type: params.type,
    query: params.q,
    from: params.from,
    to: params.to,
    limit: PAGE_SIZE,
    offset: (params.page - 1) * PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const all = stages.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Link
          href={href({ ...params, stage: undefined, page: 1 })}
          className={buttonVariants({
            variant: params.stage ? "outline" : "default",
            size: "sm",
          })}
        >
          Все · {all}
        </Link>
        {stages
          .filter((row) => row.count > 0 || row.stage === params.stage)
          .map((row) => (
            <Link
              key={row.stage}
              href={href({ ...params, stage: row.stage, page: 1 })}
              className={buttonVariants({
                variant: params.stage === row.stage ? "default" : "outline",
                size: "sm",
              })}
            >
              {STAGE_LABELS[row.stage]} · {row.count}
            </Link>
          ))}
      </div>

      <div className="rounded-lg border contain-inline-size">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Дата</TableHead>
              <TableHead className="w-44">Заказ</TableHead>
              <TableHead>Клиент</TableHead>
              <TableHead>Что</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead className="w-40">Этап</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-8 text-center"
                >
                  Заказов не найдено
                </TableCell>
              </TableRow>
            )}
            {items.map((order) => (
              <TableRow key={`${order.kind}:${order.id}`}>
                <TableCell className="text-muted-foreground align-top text-xs">
                  {dateTime.format(order.createdAt)}
                </TableCell>
                <TableCell className="align-top">
                  <Link
                    href={order.href}
                    className="font-mono text-sm font-medium hover:underline"
                  >
                    {order.number ?? "открыть"}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <OrderBadges channel={order.channel} type={order.type} />
                  </div>
                </TableCell>
                <TableCell className="align-top text-sm whitespace-normal">
                  {order.clientKey ? (
                    <Link
                      href={`/crm/clients/${encodeURIComponent(order.clientKey)}`}
                      className="hover:underline"
                    >
                      {order.clientName}
                    </Link>
                  ) : (
                    order.clientName
                  )}
                  {order.phone && (
                    <div className="text-muted-foreground text-xs">
                      +{order.phone}
                    </div>
                  )}
                </TableCell>
                <TableCell className="max-w-[320px] align-top text-sm whitespace-normal">
                  <Link href={order.href} className="hover:underline">
                    {order.title}
                  </Link>
                </TableCell>
                <TableCell className="text-right align-top text-sm">
                  <OrderMoney order={order} />
                </TableCell>
                <TableCell className="align-top text-sm">
                  <div className="flex flex-wrap gap-1">
                    <Badge
                      variant={
                        order.stage === "canceled" || order.stage === "unpaid"
                          ? "outline"
                          : order.stage === "done"
                            ? "secondary"
                            : "default"
                      }
                    >
                      {STAGE_LABELS[order.stage]}
                    </Badge>
                    {order.overdue && (
                      <Badge variant="destructive">просрочен</Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    {statusLabel(order)}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          {params.page > 1 && (
            <Link
              href={href({ ...params, page: params.page - 1 })}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              ← Назад
            </Link>
          )}
          <span className="text-muted-foreground">
            Страница {params.page} из {pages} · {total} заказов
          </span>
          {params.page < pages && (
            <Link
              href={href({ ...params, page: params.page + 1 })}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Дальше →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Все заказы в одном месте: с сайта, записи на мастер-классы, заказы с
 * площадок и из мессенджеров. Доска — что сейчас в работе, список — всё.
 */
export default async function CrmOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = paramsSchema.parse(
    Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [
        key,
        first(value) || undefined,
      ]),
    ),
  );

  return (
    <>
      <SiteHeader title="Заказы" />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {params.view === "board" ? "Заказы в работе" : "Все заказы"}
            </h1>
            <p className="text-muted-foreground max-w-3xl text-sm">
              Заказы с сайта и записи на мастер-классы подтягиваются сами.
              Заказы с Авито, Ozon, Ярмарки Мастеров, из мессенджеров и вживую
              заведите кнопкой «Новый заказ» и ведите по этапам.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/crm/orders/new" className={buttonVariants()}>
              Новый заказ
            </Link>
            <Link
              href="/crm/analytics"
              className={buttonVariants({ variant: "outline" })}
            >
              Аналитика
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          <Link
            href={href({ ...params, view: "board", stage: undefined, page: 1 })}
            aria-current={params.view === "board" ? "page" : undefined}
            className={buttonVariants({
              variant: params.view === "board" ? "secondary" : "ghost",
              size: "sm",
            })}
          >
            Доска
          </Link>
          <Link
            href={href({ ...params, view: "list", page: 1 })}
            aria-current={params.view === "list" ? "page" : undefined}
            className={buttonVariants({
              variant: params.view === "list" ? "secondary" : "ghost",
              size: "sm",
            })}
          >
            Все заказы
          </Link>
        </div>

        <Filters params={params} />

        {params.view === "board" ? (
          <Board params={params} />
        ) : (
          <List params={params} />
        )}
      </div>
    </>
  );
}
