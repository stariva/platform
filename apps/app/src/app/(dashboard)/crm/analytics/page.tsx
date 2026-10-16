import {
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import Link from "next/link";
import { rubles } from "~/components/crm/crm-meta";
import {
  type PeriodParams,
  PeriodPicker,
  resolvePeriod,
} from "~/components/crm/period";
import { RevenueChart } from "~/components/crm/revenue-chart";
import { Stat } from "~/components/crm/stat";
import {
  CHANNEL_LABELS,
  STAGE_LABELS,
  TYPE_LABELS,
  type WorkChannel,
  type WorkType,
} from "~/components/crm/work-meta";
import { SiteHeader } from "~/components/layout";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const MONTHS = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const percent = (part: number, whole: number) =>
  whole > 0
    ? `${((part / whole) * 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })}%`
    : "—";

type Totals = Awaited<ReturnType<typeof api.admin.crm.analytics>>["totals"];

/** Строка разбивки: заказы, выручка, доля, средний чек, комиссия. */
function TotalsCells({ row, revenue }: { row: Totals; revenue: number }) {
  return (
    <>
      <TableCell className="text-right tabular-nums">{row.placed}</TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {row.canceled || "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.paidOrders}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {rubles.format(row.revenue)}
      </TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {percent(row.revenue, revenue)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.averageCheck > 0 ? rubles.format(row.averageCheck) : "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.fees > 0 ? rubles.format(row.fees) : "—"}
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {rubles.format(row.net)}
      </TableCell>
    </>
  );
}

function TotalsHead({ first }: { first: string }) {
  return (
    <TableRow>
      <TableHead>{first}</TableHead>
      <TableHead className="text-right">Оформлено</TableHead>
      <TableHead className="text-right">Отменено</TableHead>
      <TableHead className="text-right">Оплачено</TableHead>
      <TableHead className="text-right">Выручка</TableHead>
      <TableHead className="text-right">Доля</TableHead>
      <TableHead className="text-right">Средний чек</TableHead>
      <TableHead className="text-right">Комиссии</TableHead>
      <TableHead className="text-right">Чистыми</TableHead>
    </TableRow>
  );
}

/**
 * Аналитика продаж со всех площадок: деньги, заказы и средний чек за период,
 * разбивка по площадкам и видам заказов, помесячно за год, что сейчас в
 * работе, лучшие товары, новые и вернувшиеся покупатели.
 */
export default async function CrmAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<PeriodParams>;
}) {
  const { today, preset, range } = resolvePeriod(await searchParams);
  const data = await api.admin.crm.analytics(range);
  const { totals, customers, inWork } = data;
  const buyers = customers.newBuyers + customers.repeat;

  return (
    <>
      <SiteHeader title="Аналитика" />
      <div className="space-y-6 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Аналитика продаж
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Все площадки вместе: сайт, мастер-классы и заказы, заведённые
            вручную. Выручка — деньги, поступившие за период (предоплата и
            доплата — в свои дни), без возвратов и отменённых заказов.
            «Оформлено» — заказы, созданные за период, без брошенных корзин.
          </p>
        </div>

        <PeriodPicker
          basePath="/crm/analytics"
          preset={preset}
          range={range}
          today={today}
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Выручка"
            value={rubles.format(totals.revenue)}
            hint={
              totals.fees > 0
                ? `Чистыми ${rubles.format(totals.net)} после комиссий площадок`
                : "Поступило денег за период"
            }
          />
          <Stat
            label="Оплаченных заказов"
            value={totals.paidOrders}
            hint={`Оформлено ${totals.placed}, отменено ${totals.canceled}`}
          />
          <Stat
            label="Средний чек"
            value={
              totals.averageCheck > 0 ? rubles.format(totals.averageCheck) : "—"
            }
            hint="Сумма заказа, оплаченного впервые за период"
          />
          <Stat
            label="Покупатели"
            value={buyers}
            hint={`Новых ${customers.newBuyers}, вернувшихся ${customers.repeat}`}
          />
          <Stat
            label="Выручка от вернувшихся"
            value={percent(customers.repeatRevenue, totals.revenue)}
            hint={`${rubles.format(customers.repeatRevenue)} от тех, кто уже покупал раньше`}
          />
        </div>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
            <div className="space-y-1.5">
              <CardTitle>Сейчас в работе</CardTitle>
              <CardDescription>
                {inWork.count} заказов на {rubles.format(inWork.amount)} · ещё
                придёт {rubles.format(inWork.toCollect)}
                {inWork.overdue > 0 && ` · просрочено ${inWork.overdue}`}
                {inWork.requests > 0 &&
                  ` · заявок без ответа ${inWork.requests}`}
              </CardDescription>
            </div>
            <Link
              href="/crm/orders"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Открыть доску
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {data.pipeline.map((row) => (
                <div key={row.stage} className="bg-muted/40 rounded-md p-3">
                  <div className="text-muted-foreground text-xs">
                    {STAGE_LABELS[row.stage]}
                  </div>
                  <div className="text-xl font-semibold tabular-nums">
                    {row.count}
                  </div>
                  <div className="text-muted-foreground text-xs tabular-nums">
                    {row.amount > 0 ? rubles.format(row.amount) : "—"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Выручка по месяцам</CardTitle>
            <CardDescription>
              Последние 12 месяцев по площадкам, независимо от выбранного
              периода. Цифры — в таблице ниже.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart months={data.months} />
          </CardContent>
        </Card>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">По площадкам</h2>
          <div className="rounded-lg border contain-inline-size">
            <Table>
              <TableHeader>
                <TotalsHead first="Площадка" />
              </TableHeader>
              <TableBody>
                {data.byChannel.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-muted-foreground py-8 text-center"
                    >
                      За этот период заказов нет
                    </TableCell>
                  </TableRow>
                )}
                {data.byChannel.map((row) => (
                  <TableRow key={row.channel}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/crm/orders?view=list&channel=${row.channel}${range.from ? `&from=${range.from}` : ""}${range.to ? `&to=${range.to}` : ""}`}
                        className="hover:underline"
                      >
                        {CHANNEL_LABELS[row.channel as WorkChannel] ??
                          row.channel}
                      </Link>
                    </TableCell>
                    <TotalsCells row={row} revenue={totals.revenue} />
                  </TableRow>
                ))}
              </TableBody>
              {data.byChannel.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell>Итого</TableCell>
                    <TotalsCells row={totals} revenue={totals.revenue} />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
          <p className="text-muted-foreground text-xs">
            «Оплачено» и средний чек — по заказам, первые деньги за которые
            пришли в этот период. Комиссии вносятся в карточке заказа вне сайта.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">По видам заказов</h2>
          <div className="rounded-lg border contain-inline-size">
            <Table>
              <TableHeader>
                <TotalsHead first="Вид" />
              </TableHeader>
              <TableBody>
                {data.byType.map((row) => (
                  <TableRow key={row.type}>
                    <TableCell className="font-medium">
                      {TYPE_LABELS[row.type as WorkType] ?? row.type}
                    </TableCell>
                    <TotalsCells row={row} revenue={totals.revenue} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Что продаётся на сайте</h2>
            <div className="rounded-lg border contain-inline-size">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Изделие</TableHead>
                    <TableHead className="text-right">Заказов</TableHead>
                    <TableHead className="text-right">Штук</TableHead>
                    <TableHead className="text-right">На сумму</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topItems.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-muted-foreground py-8 text-center"
                      >
                        За этот период оплаченных заказов с сайта нет
                      </TableCell>
                    </TableRow>
                  )}
                  {data.topItems.map((item) => (
                    <TableRow key={item.name}>
                      <TableCell className="max-w-[320px] whitespace-normal">
                        {item.name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.orders}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {rubles.format(item.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">По месяцам</h2>
            <div className="rounded-lg border contain-inline-size">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Месяц</TableHead>
                    <TableHead className="text-right">Оформлено</TableHead>
                    <TableHead className="text-right">Оплачено</TableHead>
                    <TableHead className="text-right">Выручка</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...data.months].reverse().map((month) => (
                    <TableRow key={month.month}>
                      <TableCell className="capitalize">
                        {MONTHS.format(new Date(`${month.month}-01T00:00:00Z`))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {month.placed}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {month.paidOrders}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {rubles.format(month.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
