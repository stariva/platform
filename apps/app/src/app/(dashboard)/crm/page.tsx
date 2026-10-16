import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import Link from "next/link";
import {
  CHANNEL_LABELS,
  CHANNELS,
  costPer,
  payback,
  paybackTone,
  rubles,
  type SourceView,
  sourceLabel,
  utmLabel,
} from "~/components/crm/crm-meta";
import { PeriodPicker, resolvePeriod } from "~/components/crm/period";
import { Stat } from "~/components/crm/stat";
import { SiteHeader } from "~/components/layout";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const MONTHS = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

type Row = Awaited<ReturnType<typeof api.admin.crm.report>>["rows"][number];

/** Кампании по каналам, внутри — по выручке; затем голые метки и «не с рекламы». */
function sortRows(rows: Row[]) {
  const rank = (source: SourceView) => {
    if (source.kind === "campaign") {
      return CHANNELS.indexOf(source.channel ?? "other");
    }
    return source.kind === "utm" ? CHANNELS.length : CHANNELS.length + 1;
  };
  return [...rows].sort(
    (a, b) =>
      rank(a.source) - rank(b.source) ||
      b.revenue - a.revenue ||
      b.spend - a.spend,
  );
}

/** Ссылка на создание кампании с метками источника без кампании. */
function newCampaignHref(source: SourceView) {
  const params = new URLSearchParams();
  if (source.utmSource) params.set("utm_source", source.utmSource);
  if (source.utmCampaign) params.set("utm_campaign", source.utmCampaign);
  return `/crm/campaigns?${params}`;
}

/** Показывает рекламную сводку за выбранный период и итоги по месяцам. */
export default async function CrmReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string | string[];
    from?: string | string[];
    to?: string | string[];
  }>;
}) {
  const { today, preset, range } = resolvePeriod(await searchParams);

  const { rows, ads, total, months } = await api.admin.crm.report(range);
  const sorted = sortRows(rows);
  const untracked = rows.filter((row) => row.source.kind === "utm");

  return (
    <>
      <SiteHeader title="Реклама" />
      <div className="space-y-6 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Реклама: сводка
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Сколько потрачено на каждую кампанию и сколько принесли клиенты, что
            с неё пришли. Клиент засчитывается кампании по UTM-метке первого
            захода на сайт или по источнику, выбранному в его карточке, и вся
            его выручка — включая повторные покупки — идёт этой кампании.
          </p>
        </div>

        <PeriodPicker
          basePath="/crm"
          preset={preset}
          range={range}
          today={today}
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Расход на рекламу" value={rubles.format(ads.spend)} />
          <Stat
            label="Выручка с рекламы"
            value={rubles.format(ads.revenue)}
            hint={`Всего за период ${rubles.format(total.revenue)}`}
          />
          <Stat
            label="Окупаемость"
            value={payback(ads.revenue, ads.spend)}
            tone={paybackTone(ads.revenue, ads.spend)}
            hint="Рублей выручки на рубль рекламы"
          />
          <Stat
            label="Новые покупатели с рекламы"
            value={ads.buyers}
            hint={`Обратились впервые: ${ads.leads}`}
          />
          <Stat
            label="Цена покупателя"
            value={costPer(ads.spend, ads.buyers)}
            hint="Расход на одного нового покупателя"
          />
        </div>

        {untracked.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
            Есть клиенты с метками, для которых не заведена кампания:{" "}
            {untracked
              .map((row) =>
                utmLabel(row.source.utmSource, row.source.utmCampaign),
              )
              .join(", ")}
            . Заведите кампанию и вносите по ней расходы — тогда будет видно,
            окупается ли она.
          </div>
        )}

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">По кампаниям</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Кампания</TableHead>
                  <TableHead className="text-right">Расход</TableHead>
                  <TableHead className="text-right">Обратились</TableHead>
                  <TableHead className="text-right">Купили впервые</TableHead>
                  <TableHead className="text-right">Цена покупателя</TableHead>
                  <TableHead className="text-right">
                    Оплаченных заказов
                  </TableHead>
                  <TableHead className="text-right">Выручка</TableHead>
                  <TableHead className="text-right">Окупаемость</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-muted-foreground py-8 text-center"
                    >
                      За этот период ничего нет.{" "}
                      <Link href="/crm/campaigns" className="underline">
                        Заведите кампании
                      </Link>{" "}
                      и вносите расходы.
                    </TableCell>
                  </TableRow>
                )}
                {sorted.map((row) => (
                  <TableRow key={row.source.key}>
                    <TableCell className="max-w-[320px] align-top whitespace-normal">
                      {row.source.kind === "campaign" &&
                      row.source.campaignId ? (
                        <Link
                          href={`/crm/campaigns/${row.source.campaignId}`}
                          className="font-medium hover:underline"
                        >
                          {sourceLabel(row.source)}
                        </Link>
                      ) : (
                        <span className="font-medium">
                          {sourceLabel(row.source)}
                        </span>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {row.source.channel && (
                          <Badge variant="outline">
                            {CHANNEL_LABELS[row.source.channel]}
                          </Badge>
                        )}
                        {row.source.kind === "campaign" &&
                          row.source.utmSource && (
                            <span className="text-muted-foreground text-xs">
                              {utmLabel(
                                row.source.utmSource,
                                row.source.utmCampaign,
                              )}
                            </span>
                          )}
                        {row.source.kind === "utm" && (
                          <Link
                            href={newCampaignHref(row.source)}
                            className="text-xs underline"
                          >
                            Завести кампанию
                          </Link>
                        )}
                        {row.source.archived && (
                          <Badge variant="secondary">в архиве</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right align-top tabular-nums">
                      {row.source.kind === "campaign"
                        ? rubles.format(row.spend)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right align-top tabular-nums">
                      <Link
                        href={`/crm/clients?source=${encodeURIComponent(row.source.key)}`}
                        className="hover:underline"
                      >
                        {row.leads}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right align-top tabular-nums">
                      {row.buyers}
                    </TableCell>
                    <TableCell className="text-right align-top tabular-nums">
                      {costPer(row.spend, row.buyers)}
                    </TableCell>
                    <TableCell className="text-right align-top tabular-nums">
                      {row.paidDeals}
                    </TableCell>
                    <TableCell className="text-right align-top tabular-nums">
                      {rubles.format(row.revenue)}
                    </TableCell>
                    <TableCell
                      className={`text-right align-top font-medium tabular-nums ${paybackTone(row.revenue, row.spend)}`}
                    >
                      {payback(row.revenue, row.spend)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {sorted.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell>Итого</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rubles.format(total.spend)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {total.leads}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {total.buyers}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {costPer(ads.spend, ads.buyers)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {total.paidDeals}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rubles.format(total.revenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {payback(ads.revenue, ads.spend)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
          <p className="text-muted-foreground text-xs">
            «Обратились» — впервые оформили заказ, заявку или запись за период;
            «Купили впервые» — первая оплата за период. Выручка — деньги,
            поступившие за период, без возвратов. Цена покупателя и окупаемость
            в итогах — только по рекламе.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">По месяцам</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Месяц</TableHead>
                  <TableHead className="text-right">Расход</TableHead>
                  <TableHead className="text-right">
                    Выручка с рекламы
                  </TableHead>
                  <TableHead className="text-right">Окупаемость</TableHead>
                  <TableHead className="text-right">
                    Новые покупатели с рекламы
                  </TableHead>
                  <TableHead className="text-right">Цена покупателя</TableHead>
                  <TableHead className="text-right">Вся выручка</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...months].reverse().map((month) => (
                  <TableRow key={month.month}>
                    <TableCell className="capitalize">
                      {MONTHS.format(new Date(`${month.month}-01T00:00:00Z`))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rubles.format(month.spend)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rubles.format(month.adRevenue)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${paybackTone(month.adRevenue, month.spend)}`}
                    >
                      {payback(month.adRevenue, month.spend)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {month.adBuyers}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {costPer(month.spend, month.adBuyers)}
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
    </>
  );
}
