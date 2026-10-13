import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import Link from "next/link";
import { z } from "zod";
import { CampaignForm } from "~/components/crm/campaign-form";
import {
  CHANNEL_LABELS,
  CHANNELS,
  costPer,
  formatDay,
  payback,
  paybackTone,
  rubles,
  utmLabel,
} from "~/components/crm/crm-meta";
import { SiteHeader } from "~/components/layout";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const utmSchema = z.string().trim().min(1).max(120);

const first = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

export default async function CrmCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{
    utm_source?: string | string[];
    utm_campaign?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const utmSource = utmSchema.safeParse(first(params.utm_source));
  const utmCampaign = utmSchema.safeParse(first(params.utm_campaign));
  const campaigns = await api.admin.crm.campaigns();
  const sorted = [...campaigns].sort(
    (a, b) =>
      Number(a.archived) - Number(b.archived) ||
      CHANNELS.indexOf(a.channel) - CHANNELS.indexOf(b.channel) ||
      a.name.localeCompare(b.name, "ru"),
  );

  return (
    <>
      <SiteHeader title="Кампании и расходы" />
      <div className="space-y-6 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Кампании и расходы
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Заведите каждую рекламу, на которую тратите деньги, и вносите
            расходы по ней: пополнения кабинета, оплату посевов и блогеров.
            Итоги здесь — за всё время, по периодам — в{" "}
            <Link href="/crm" className="underline">
              сводке
            </Link>
            .
          </p>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Кампания</TableHead>
                <TableHead className="text-right">Потрачено</TableHead>
                <TableHead className="text-right">Клиентов</TableHead>
                <TableHead className="text-right">Купили</TableHead>
                <TableHead className="text-right">Цена покупателя</TableHead>
                <TableHead className="text-right">Выручка</TableHead>
                <TableHead className="text-right">Окупаемость</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-muted-foreground py-8 text-center"
                  >
                    Кампаний пока нет — заведите первую ниже
                  </TableCell>
                </TableRow>
              )}
              {sorted.map((campaign) => (
                <TableRow
                  key={campaign.id}
                  className={campaign.archived ? "opacity-60" : undefined}
                >
                  <TableCell className="max-w-[320px] align-top whitespace-normal">
                    <Link
                      href={`/crm/campaigns/${campaign.id}`}
                      className="font-medium hover:underline"
                    >
                      {campaign.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">
                        {CHANNEL_LABELS[campaign.channel]}
                      </Badge>
                      {campaign.archived && (
                        <Badge variant="secondary">закончилась</Badge>
                      )}
                      <span className="text-muted-foreground text-xs">
                        {utmLabel(campaign.utmSource, campaign.utmCampaign) ||
                          "без меток"}
                        {campaign.lastExpense &&
                          ` · расход ${formatDay(campaign.lastExpense)}`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    {rubles.format(campaign.spend)}
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    <Link
                      href={`/crm/clients?source=${encodeURIComponent(`c:${campaign.id}`)}`}
                      className="hover:underline"
                    >
                      {campaign.leads}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    {campaign.buyers}
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    {costPer(campaign.spend, campaign.buyers)}
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    {rubles.format(campaign.revenue)}
                  </TableCell>
                  <TableCell
                    className={`text-right align-top font-medium tabular-nums ${paybackTone(campaign.revenue, campaign.spend)}`}
                  >
                    {payback(campaign.revenue, campaign.spend)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Card className="max-w-2xl" id="new">
          <CardHeader>
            <CardTitle>Новая кампания</CardTitle>
            <CardDescription>
              Метки берите из ссылки объявления: …?utm_source=yandex&amp;
              utm_campaign=lamps. Если кампании без меток — оставьте поля
              пустыми.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CampaignForm
              initial={{
                name: "",
                channel: "other",
                utmSource: utmSource.success ? utmSource.data : "",
                utmCampaign: utmCampaign.success ? utmCampaign.data : "",
                notes: "",
                archived: false,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
