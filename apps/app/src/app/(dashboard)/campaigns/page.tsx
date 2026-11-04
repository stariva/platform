import {
  buttonVariants,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import { Badge } from "@stariva/ui/reui";
import Link from "next/link";
import {
  CAMPAIGN_STATUS_LABELS,
  share,
} from "~/components/campaigns/campaign-meta";
import { dateTime } from "~/components/crm/crm-meta";
import { SiteHeader } from "~/components/layout";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const STATUS_VARIANTS = {
  draft: "secondary",
  sending: "warning-light",
  sent: "success-light",
} as const;

/**
 * Рассылки покупателям: черновики и отправленные, со счётчиками — скольким
 * ушло, сколько открыли и перешли по кнопке.
 */
export default async function CampaignsPage() {
  const campaigns = await api.admin.campaigns.list();

  return (
    <>
      <SiteHeader title="Рассылки" />
      <div className="space-y-6 px-4 pb-10 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Рассылки</h1>
            <p className="text-muted-foreground max-w-3xl text-sm">
              Письма покупателям мастер-классов. «Открыли» считается по картинке
              в письме и всегда с запасом: Gmail, Яндекс и Apple Mail подгружают
              картинки сами. Точнее всего — переходы по кнопке.
            </p>
          </div>
          <Link href="/campaigns/new" className={buttonVariants()}>
            Новая рассылка
          </Link>
        </div>

        <div className="rounded-lg border contain-inline-size">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Рассылка</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Отправлено</TableHead>
                <TableHead className="text-right">Открыли</TableHead>
                <TableHead className="text-right">Перешли</TableHead>
                <TableHead className="text-right">Отписались</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground py-8 text-center"
                  >
                    Рассылок пока не было
                  </TableCell>
                </TableRow>
              )}
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="max-w-[360px] whitespace-normal">
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="font-medium hover:underline"
                    >
                      {campaign.name}
                    </Link>
                    <div className="text-muted-foreground text-xs break-words">
                      {campaign.subject}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <Badge variant={STATUS_VARIANTS[campaign.status]}>
                      {CAMPAIGN_STATUS_LABELS[campaign.status]}
                    </Badge>
                    <div className="text-muted-foreground mt-1 text-xs whitespace-nowrap">
                      {dateTime.format(
                        campaign.startedAt ?? campaign.createdAt,
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaign.status === "draft"
                      ? "—"
                      : `${campaign.sent} из ${campaign.recipients}`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaign.opened}{" "}
                    <span className="text-muted-foreground text-xs">
                      {share(campaign.opened, campaign.sent)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaign.clicked}{" "}
                    <span className="text-muted-foreground text-xs">
                      {share(campaign.clicked, campaign.sent)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaign.unsubscribed}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
