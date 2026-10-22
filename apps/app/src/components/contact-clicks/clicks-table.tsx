import type {
  CampaignAttribution,
  ContactClickChannel,
  SessionEntry,
  VisitorInfo,
} from "@stariva/db/schema";
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import Link from "next/link";
import { visitorSummary } from "~/components/carts/cart-meta";
import {
  sourceLabel as campaignLabel,
  dateTime,
  type SourceView,
} from "~/components/crm/crm-meta";
import { STATUS_LABELS, statusVariant } from "~/components/orders/order-meta";
import { CHANNEL_LABELS, sourceLabel } from "./click-meta";

export interface ClickTableRow {
  id: string;
  createdAt: Date;
  channel: ContactClickChannel;
  source: string | null;
  page: string | null;
  entry: SessionEntry | null;
  attribution: CampaignAttribution | null;
  ip: string | null;
  visitor: VisitorInfo | null;
  browserId: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  browserClicks: number;
  hasCart: boolean;
  // Реклама, которой засчитан переход
  campaign: SourceView;
  // Откуда пришёл без меток: сайт, «Прямой заход», объявление без UTM
  site: string;
  order: { id: string; number: number; status: string } | null;
}

/** utm_content и utm_term: какое объявление и по какому запросу. */
function adDetails(row: ClickTableRow) {
  const touch = row.entry?.utm_source ? row.entry : row.attribution?.last;
  return [touch?.utm_content, touch?.utm_term].filter(Boolean).join(" · ");
}

/** Таблица переходов: когда, куда, кто, с какой рекламы и чем кончилось. */
export function ClicksTable({ rows }: { rows: ClickTableRow[] }) {
  return (
    <div className="rounded-lg border contain-inline-size">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Когда</TableHead>
            <TableHead>Куда</TableHead>
            <TableHead>Кто</TableHead>
            <TableHead>Откуда пришёл</TableHead>
            <TableHead>Чем кончилось</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-muted-foreground py-8 text-center"
              >
                За этот период переходов нет
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => {
            const details = adDetails(row);
            const fromAd = row.campaign.kind !== "none";
            const block = sourceLabel(row.source);
            return (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                  {dateTime.format(row.createdAt)}
                </TableCell>
                <TableCell className="max-w-[240px] text-sm whitespace-normal">
                  <Badge variant="outline">{CHANNEL_LABELS[row.channel]}</Badge>
                  <div className="text-muted-foreground mt-1 text-xs break-words">
                    {[block, row.page].filter(Boolean).join(" · ")}
                  </div>
                </TableCell>
                <TableCell className="max-w-[260px] text-sm whitespace-normal">
                  {row.userId ? (
                    <Link
                      href={`/users/${row.userId}`}
                      className="hover:underline"
                    >
                      {row.userName}
                      <div className="text-muted-foreground text-xs">
                        {row.userEmail}
                      </div>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Гость</span>
                  )}
                  {visitorSummary(row.visitor) && (
                    <div className="text-muted-foreground text-xs">
                      {visitorSummary(row.visitor)}
                    </div>
                  )}
                  {row.ip && (
                    <div className="text-muted-foreground font-mono text-xs">
                      {row.ip}
                      {row.visitor?.isp && ` · ${row.visitor.isp}`}
                    </div>
                  )}
                  {row.browserClicks > 1 && (
                    <div className="text-muted-foreground text-xs">
                      Переходов с этого браузера: {row.browserClicks}
                    </div>
                  )}
                </TableCell>
                <TableCell className="max-w-[280px] text-sm whitespace-normal">
                  <div className={fromAd ? "" : "text-muted-foreground"}>
                    {fromAd ? campaignLabel(row.campaign) : row.site}
                  </div>
                  {row.campaign.kind === "utm" && (
                    <Badge variant="secondary" className="mt-1">
                      кампания не заведена
                    </Badge>
                  )}
                  {details && (
                    <div className="text-muted-foreground text-xs break-words">
                      {details}
                    </div>
                  )}
                  {fromAd && !row.entry?.utm_source && (
                    <div className="text-muted-foreground text-xs">
                      Реклама с прошлого захода, сейчас: {row.site}
                    </div>
                  )}
                  {fromAd && row.entry?.utm_source && row.entry.referrer && (
                    <div className="text-muted-foreground text-xs">
                      с {row.entry.referrer}
                    </div>
                  )}
                  {row.entry?.landing && (
                    <div className="text-muted-foreground text-xs break-words">
                      вход: {row.entry.landing}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {row.order ? (
                    <div className="flex flex-col items-start gap-1">
                      <Link
                        href={`/orders/${row.order.id}`}
                        className="hover:underline"
                      >
                        Заказ №{row.order.number}
                      </Link>
                      <Badge variant={statusVariant(row.order.status)}>
                        {STATUS_LABELS[row.order.status] ?? row.order.status}
                      </Badge>
                    </div>
                  ) : row.hasCart && row.browserId ? (
                    <Link
                      href={`/carts/${row.browserId}`}
                      className="hover:underline"
                    >
                      Корзина
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
