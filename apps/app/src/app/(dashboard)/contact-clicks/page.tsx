import type { ContactClickChannel } from "@stariva/db/schema";
import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import type { ReactNode } from "react";
import { z } from "zod";
import {
  CHANNEL_LABELS,
  CONTACT_CHANNELS,
} from "~/components/contact-clicks/click-meta";
import { ClicksTable } from "~/components/contact-clicks/clicks-table";
import { costPer, rubles } from "~/components/crm/crm-meta";
import {
  first,
  type PeriodParams,
  PeriodPicker,
  resolvePeriod,
} from "~/components/crm/period";
import { SourceBadge } from "~/components/crm/source-badge";
import { Stat } from "~/components/crm/stat";
import { SiteHeader } from "~/components/layout";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const BASE = "/contact-clicks";
const PAGE_SIZE = 50;

const querySchema = z.string().trim().max(100);
const channelSchema = z.enum(
  CONTACT_CHANNELS as [ContactClickChannel, ...ContactClickChannel[]],
);
const pageSchema = z.coerce
  .number()
  .finite()
  .transform((value) => Math.max(1, Math.floor(value)))
  .refine((value) => Number.isSafeInteger((value - 1) * PAGE_SIZE));

interface Filters {
  period: Record<string, string>;
  channel?: ContactClickChannel;
  query: string;
}

function pageHref({ period, channel, query }: Filters, page = 1) {
  const params = new URLSearchParams(period);
  if (channel) params.set("channel", channel);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${BASE}?${search}` : BASE;
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

const ChannelHeads = () =>
  CONTACT_CHANNELS.map((channel) => (
    <TableHead key={channel} className="text-right">
      {CHANNEL_LABELS[channel]}
    </TableHead>
  ));

const ChannelCells = ({
  channels,
}: {
  channels: Record<ContactClickChannel, number>;
}) =>
  CONTACT_CHANNELS.map((channel) => (
    <TableCell
      key={channel}
      className="text-muted-foreground text-right tabular-nums"
    >
      {channels[channel] || "—"}
    </TableCell>
  ));

/**
 * Переходы в мессенджеры: кто и когда нажал на Telegram, WhatsApp, MAX или
 * телефон, с какой рекламы пришёл, и сколько стоил такой человек по
 * расходам из «Кампаний и расходов».
 */
export default async function ContactClicksPage({
  searchParams,
}: {
  searchParams: Promise<
    PeriodParams & {
      channel?: string | string[];
      q?: string | string[];
      page?: string | string[];
    }
  >;
}) {
  const params = await searchParams;
  const { today, preset, range } = resolvePeriod(params);
  const parsedChannel = channelSchema.safeParse(first(params.channel));
  const parsedQuery = querySchema.safeParse(first(params.q));
  const parsedPage = pageSchema.safeParse(first(params.page));
  const period: Record<string, string> = preset
    ? preset === "month"
      ? {}
      : { period: preset }
    : Object.fromEntries(
        Object.entries(range).filter(
          (entry): entry is [string, string] => !!entry[1],
        ),
      );
  const filters: Filters = {
    period,
    channel: parsedChannel.success ? parsedChannel.data : undefined,
    query: parsedQuery.success ? parsedQuery.data : "",
  };
  const page = parsedPage.success ? parsedPage.data : 1;

  const { items, total, summary } = await api.admin.contactClicks.list({
    ...range,
    channel: filters.channel,
    query: filters.query || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) redirect(pageHref(filters, pages));

  const ads = summary.sources.filter((row) => row.source.kind !== "none");
  const adClicks = ads.reduce((sum, row) => sum + row.clicks, 0);
  const adPeople = ads.reduce((sum, row) => sum + row.people, 0);
  const adSpend = ads.reduce((sum, row) => sum + row.spend, 0);

  return (
    <>
      <SiteHeader title="Переходы в мессенджеры" />
      <div className="space-y-6 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Переходы в мессенджеры
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Каждое нажатие на Telegram, WhatsApp, MAX или телефон на сайте.
            Написал ли человек на самом деле, сайт не знает — только что нажал.
            Реклама — по меткам этого захода, а без них — по последнему заходу с
            рекламы за 90 дней. «Людей» считаем по браузеру: один человек с
            телефона и компьютера — это двое.
          </p>
        </div>

        <PeriodPicker
          basePath={BASE}
          preset={preset}
          range={range}
          today={today}
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Переходов"
            value={summary.total.clicks}
            hint={CONTACT_CHANNELS.map(
              (channel) =>
                `${CHANNEL_LABELS[channel]} ${summary.total.channels[channel]}`,
            ).join(" · ")}
          />
          <Stat
            label="Людей"
            value={summary.total.people}
            hint="Разных браузеров, нажавших хотя бы раз"
          />
          <Stat
            label="С рекламы"
            value={adPeople}
            hint={`${adClicks} переходов от людей с рекламы`}
          />
          <Stat
            label="Человек с рекламы обошёлся"
            value={costPer(adSpend, adPeople)}
            hint={`Расход за период ${rubles.format(adSpend)}`}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>По рекламе</CardTitle>
            <CardDescription>
              Расход — из «Кампаний и расходов» за те же дни. Кампанию без
              переходов тоже видно: деньги ушли, а написать никто не нажал.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border contain-inline-size">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Источник</TableHead>
                    <TableHead className="text-right">Переходов</TableHead>
                    <TableHead className="text-right">Людей</TableHead>
                    <ChannelHeads />
                    <TableHead className="text-right">Расход</TableHead>
                    <TableHead className="text-right">За человека</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.sources.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-muted-foreground py-8 text-center"
                      >
                        За этот период переходов и расходов нет
                      </TableCell>
                    </TableRow>
                  )}
                  {summary.sources.map((row) => (
                    <TableRow key={row.source.key}>
                      <TableCell>
                        {row.source.campaignId ? (
                          <Link
                            href={`/crm/campaigns/${row.source.campaignId}`}
                            className="hover:underline"
                          >
                            <SourceBadge source={row.source} />
                          </Link>
                        ) : (
                          <SourceBadge source={row.source} />
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.clicks}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {row.people}
                      </TableCell>
                      <ChannelCells channels={row.channels} />
                      <TableCell className="text-right tabular-nums">
                        {row.spend > 0 ? rubles.format(row.spend) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {costPer(row.spend, row.people)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {summary.sites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Не с рекламы: откуда пришли</CardTitle>
              <CardDescription>
                Сайт, с которого человек зашёл в этот раз. Браузеры часто не
                передают источник — тогда это «Прямой заход».
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border contain-inline-size">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Откуда</TableHead>
                      <TableHead className="text-right">Переходов</TableHead>
                      <TableHead className="text-right">Людей</TableHead>
                      <ChannelHeads />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.sites.map((row) => (
                      <TableRow key={row.site}>
                        <TableCell>{row.site}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.clicks}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {row.people}
                        </TableCell>
                        <ChannelCells channels={row.channels} />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Все переходы</h2>
          <div className="flex flex-wrap gap-2">
            <FilterLink
              href={pageHref({ ...filters, channel: undefined })}
              active={!filters.channel}
            >
              Все · {summary.total.clicks}
            </FilterLink>
            {CONTACT_CHANNELS.map((channel) => (
              <FilterLink
                key={channel}
                href={pageHref({ ...filters, channel })}
                active={filters.channel === channel}
              >
                {CHANNEL_LABELS[channel]} · {summary.total.channels[channel]}
              </FilterLink>
            ))}
          </div>

          <form action={BASE} className="flex max-w-md gap-2">
            {Object.entries(filters.period).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            {filters.channel && (
              <input type="hidden" name="channel" value={filters.channel} />
            )}
            <Input
              type="search"
              name="q"
              defaultValue={filters.query}
              placeholder="IP, город, имя, почта, метка или страница"
              aria-label="Поиск по переходам"
            />
            <Button type="submit" variant="outline">
              Найти
            </Button>
            {filters.query && (
              <Link
                href={pageHref({ ...filters, query: "" })}
                className={buttonVariants({ variant: "ghost" })}
              >
                Сбросить
              </Link>
            )}
          </form>

          {filters.query && (
            <p className="text-muted-foreground text-sm">Найдено {total}</p>
          )}

          <ClicksTable rows={items} />

          {pages > 1 && (
            <nav className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Страница {page} из {pages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={pageHref(filters, page - 1)}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Назад
                  </Link>
                )}
                {page < pages && (
                  <Link
                    href={pageHref(filters, page + 1)}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Вперёд
                  </Link>
                )}
              </div>
            </nav>
          )}
        </section>
      </div>
    </>
  );
}
