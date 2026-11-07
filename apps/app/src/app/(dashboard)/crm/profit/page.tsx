import {
  buttonVariants,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import { Alert, AlertDescription } from "@stariva/ui/reui";
import Link from "next/link";
import {
  COST_LABELS,
  profitTone,
  rubles,
  sharePercent,
} from "~/components/crm/crm-meta";
import {
  type PeriodParams,
  PeriodPicker,
  resolvePeriod,
} from "~/components/crm/period";
import { Stat } from "~/components/crm/stat";
import {
  CHANNEL_LABELS,
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

type Profit = Awaited<ReturnType<typeof api.admin.crm.profit>>;

/** Строка «из чего сложилась прибыль»: статья, сумма и доля выручки. */
function FlowRow({
  label,
  amount,
  revenue,
  total,
  minus,
}: {
  label: string;
  amount: number;
  revenue: number;
  total?: boolean;
  minus?: boolean;
}) {
  return (
    <TableRow className={total ? "bg-muted/40 font-medium" : ""}>
      <TableCell className={minus ? "text-muted-foreground pl-6" : ""}>
        {label}
      </TableCell>
      <TableCell
        className={`text-right tabular-nums ${total ? profitTone(amount) : ""}`}
      >
        {minus ? "− " : ""}
        {rubles.format(amount)}
      </TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {sharePercent(amount, revenue)}
      </TableCell>
    </TableRow>
  );
}

/** Разбивка: заказы, выручка, затраты, что осталось и какая это доля. */
function BreakdownTable({
  first,
  rows,
  label,
}: {
  first: string;
  rows: (Omit<Profit["byChannel"][number], "key"> & { key: string })[];
  label: (key: string) => string;
}) {
  return (
    <div className="rounded-lg border contain-inline-size">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{first}</TableHead>
            <TableHead className="text-right">Оплачено</TableHead>
            <TableHead className="text-right">Выручка</TableHead>
            <TableHead className="text-right">Затраты</TableHead>
            <TableHead className="text-right">Прибыль</TableHead>
            <TableHead className="text-right">Маржа</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-muted-foreground py-8 text-center"
              >
                За этот период денег не было
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-medium">
                {label(row.key)}
                {row.missingOrders > 0 && (
                  <div className="text-muted-foreground text-xs font-normal">
                    без материалов: {row.missingOrders}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.paidOrders}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {rubles.format(row.revenue)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {rubles.format(row.costs)}
              </TableCell>
              <TableCell
                className={`text-right font-medium tabular-nums ${profitTone(row.margin)}`}
              >
                {rubles.format(row.margin)}
              </TableCell>
              <TableCell className="text-muted-foreground text-right tabular-nums">
                {sharePercent(row.margin, row.revenue)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Прибыль за период: выручка минус затраты на заказы, реклама и постоянные
 * расходы. Показывает, сколько заказов ещё без материалов: их прибыль завышена.
 */
export default async function CrmProfitPage({
  searchParams,
}: {
  searchParams: Promise<PeriodParams>;
}) {
  const { today, preset, range } = resolvePeriod(await searchParams);
  const data = await api.admin.crm.profit(range);
  const { revenue, totalCosts, margin, adSpend, overhead, net } = data;

  return (
    <>
      <SiteHeader title="Прибыль" />
      <div className="flex flex-col gap-6 px-4 pb-10 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Прибыль</h1>
            <p className="text-muted-foreground max-w-3xl text-sm">
              Сколько денег осталось за период. Выручка — по дням оплат, затраты
              — по своим дням. Работа мастера не считается: только потраченные
              деньги.
            </p>
          </div>
          <Link
            href="/crm/expenses"
            className={buttonVariants({ variant: "outline" })}
          >
            Постоянные расходы и ставки
          </Link>
        </div>

        <PeriodPicker
          basePath="/crm/profit"
          preset={preset}
          range={range}
          today={today}
        />

        {data.missingOrders > 0 && (
          <Alert variant="warning">
            <AlertDescription>
              <span>
                В {data.missingOrders} из {data.paidOrders} оплаченных заказов
                не внесены материалы (выручка{" "}
                {rubles.format(data.missingRevenue)}), поэтому прибыль завышена.{" "}
                <Link
                  href="/crm/orders?view=list&materials=missing"
                  className="underline"
                >
                  Внести материалы
                </Link>
              </span>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Выручка"
            value={rubles.format(revenue)}
            hint={`Оплачено заказов: ${data.paidOrders}`}
          />
          <Stat
            label="Затраты на заказы"
            value={rubles.format(totalCosts)}
            hint={`${sharePercent(totalCosts, revenue)} выручки`}
          />
          <Stat
            label="Прибыль с заказов"
            value={rubles.format(margin)}
            tone={profitTone(margin)}
            hint={`Маржа ${sharePercent(margin, revenue)}`}
          />
          <Stat
            label="Реклама и постоянные расходы"
            value={rubles.format(adSpend + overhead)}
            hint={`Реклама ${rubles.format(adSpend)}, постоянные ${rubles.format(overhead)}`}
          />
          <Stat
            label="Чистая прибыль"
            value={rubles.format(net)}
            tone={profitTone(net)}
            hint={`${sharePercent(net, revenue)} выручки`}
          />
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Из чего сложилась
            </h2>
            <div className="rounded-lg border contain-inline-size">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Статья</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead className="text-right">Доля</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <FlowRow
                    label="Выручка"
                    amount={revenue}
                    revenue={revenue}
                    total
                  />
                  {data.costs
                    .filter((row) => row.amount > 0)
                    .map((row) => (
                      <FlowRow
                        key={row.category}
                        label={COST_LABELS[row.category]}
                        amount={row.amount}
                        revenue={revenue}
                        minus
                      />
                    ))}
                  <FlowRow
                    label="Прибыль с заказов"
                    amount={margin}
                    revenue={revenue}
                    total
                  />
                  <FlowRow
                    label="Реклама"
                    amount={adSpend}
                    revenue={revenue}
                    minus
                  />
                  <FlowRow
                    label="Постоянные расходы"
                    amount={overhead}
                    revenue={revenue}
                    minus
                  />
                  <FlowRow
                    label="Чистая прибыль"
                    amount={net}
                    revenue={revenue}
                    total
                  />
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold tracking-tight">По месяцам</h2>
            <div className="rounded-lg border contain-inline-size">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Месяц</TableHead>
                    <TableHead className="text-right">Выручка</TableHead>
                    <TableHead className="text-right">Затраты</TableHead>
                    <TableHead className="text-right">Реклама</TableHead>
                    <TableHead className="text-right">Постоянные</TableHead>
                    <TableHead className="text-right">Чистая прибыль</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...data.months].reverse().map((month) => (
                    <TableRow key={month.month}>
                      <TableCell className="capitalize">
                        {MONTHS.format(new Date(`${month.month}-01T00:00:00Z`))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {rubles.format(month.revenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {rubles.format(month.costs)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {rubles.format(month.adSpend)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {rubles.format(month.overhead)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium tabular-nums ${profitTone(month.net)}`}
                      >
                        {rubles.format(month.net)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Что выгоднее продавать
          </h2>
          <div className="rounded-lg border contain-inline-size">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Изделие или мастер-класс</TableHead>
                  <TableHead className="text-right">Заказов</TableHead>
                  <TableHead className="text-right">Штук</TableHead>
                  <TableHead className="text-right">Выручка</TableHead>
                  <TableHead className="text-right">Учтено заказов</TableHead>
                  <TableHead className="text-right">Прибыль с заказа</TableHead>
                  <TableHead className="text-right">Маржа</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-muted-foreground py-8 text-center"
                    >
                      За этот период оплаченных заказов с сайта нет
                    </TableCell>
                  </TableRow>
                )}
                {data.items.map((item) => {
                  const earned = item.countedRevenue - item.countedCosts;
                  return (
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
                      <TableCell className="text-muted-foreground text-right tabular-nums">
                        {item.countedOrders}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${profitTone(earned)}`}
                      >
                        {item.countedOrders > 0
                          ? rubles.format(earned / item.countedOrders)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums">
                        {sharePercent(earned, item.countedRevenue)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              {data.items.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={7} className="whitespace-normal">
                      Прибыль и маржа — только по заказам, которые оплачены
                      полностью и где внесены материалы.
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </section>

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold tracking-tight">
              По площадкам
            </h2>
            <BreakdownTable
              first="Площадка"
              rows={data.byChannel}
              label={(key) => CHANNEL_LABELS[key as WorkChannel] ?? key}
            />
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold tracking-tight">
              По видам заказов
            </h2>
            <BreakdownTable
              first="Вид"
              rows={data.byType}
              label={(key) => TYPE_LABELS[key as WorkType] ?? key}
            />
          </section>
        </div>
      </div>
    </>
  );
}
