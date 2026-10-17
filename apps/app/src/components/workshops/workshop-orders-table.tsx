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
import {
  type VisitorInfo,
  visitorPlace,
} from "~/components/visitors/visitor-card";
import { WorkshopBriefButton } from "./workshop-brief-button";
import { WorkshopOrderRemove } from "./workshop-order-remove";
import { WorkshopReceiptsButton } from "./workshop-receipts-button";

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

export const WORKSHOP_ORDER_STATUS_LABELS = {
  paid: "Оплачен",
  pending: "Ждёт оплаты",
  canceled: "Отменён",
  refunded: "Возврат",
} as const;

const statusVariant = {
  paid: "default",
  pending: "secondary",
  canceled: "outline",
  refunded: "destructive",
} as const;

export interface WorkshopOrderRow {
  id: string;
  workshopSlug: string;
  workshopTitle: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  contactEmail: string | null;
  amount: number;
  status: keyof typeof WORKSHOP_ORDER_STATUS_LABELS;
  createdAt: Date;
  paidAt: Date | null;
  telegramLinked: boolean;
  /** У курса есть PDF-бриф. */
  hasBrief: boolean;
  /** Когда бриф ушёл письмом; null — не уходил. */
  briefSentAt: Date | null;
  receiptCount: number;
  receiptsExpected: number;
  receiptsUnsent: number;
  preorder: boolean;
  utmSource: string | null;
  utmCampaign: string | null;
  visitor: VisitorInfo | null;
}

/** Заказы мастер-классов: кто, на какой курс, когда и оплатил ли. */
export function WorkshopOrdersTable({
  rows,
  showWorkshop,
}: {
  rows: WorkshopOrderRow[];
  showWorkshop: boolean;
}) {
  const columns = showWorkshop ? 9 : 8;
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Кто</TableHead>
            {showWorkshop && <TableHead>Мастер-класс</TableHead>}
            <TableHead>Откуда</TableHead>
            <TableHead>Когда</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="text-right">Сумма</TableHead>
            <TableHead>Чек</TableHead>
            <TableHead>Бриф</TableHead>
            <TableHead>
              <span className="sr-only">Действия</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={columns}
                className="text-muted-foreground py-8 text-center"
              >
                Заказов нет
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-[320px] align-top whitespace-normal">
                <Link
                  href={`/users/${row.userId}`}
                  className="text-sm font-medium hover:underline"
                >
                  {row.userName}
                </Link>
                <div className="text-muted-foreground text-xs break-all">
                  {row.userEmail}
                  {row.contactEmail && row.contactEmail !== row.userEmail && (
                    <> · в заказе {row.contactEmail}</>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {row.telegramLinked && (
                    <Badge variant="outline">Telegram</Badge>
                  )}
                  {row.utmSource && (
                    <Badge variant="outline">
                      {row.utmSource}
                      {row.utmCampaign && ` / ${row.utmCampaign}`}
                    </Badge>
                  )}
                </div>
              </TableCell>
              {showWorkshop && (
                <TableCell className="max-w-[280px] align-top text-sm whitespace-normal">
                  {row.workshopTitle ?? row.workshopSlug}
                </TableCell>
              )}
              <TableCell className="align-top text-sm whitespace-normal">
                {row.visitor ? (
                  <>
                    <div>
                      {visitorPlace(row.visitor) ?? "Город не определён"}
                    </div>
                    <div className="text-muted-foreground text-xs break-all">
                      {row.visitor.ip ?? "IP не определён"}
                    </div>
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="align-top text-sm whitespace-nowrap">
                {dateFormat.format(row.createdAt)}
                {row.paidAt && (
                  <div className="text-muted-foreground text-xs">
                    оплачен {dateFormat.format(row.paidAt)}
                  </div>
                )}
              </TableCell>
              <TableCell className="align-top">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={statusVariant[row.status]}>
                    {WORKSHOP_ORDER_STATUS_LABELS[row.status]}
                  </Badge>
                  {row.preorder && <Badge variant="secondary">предзаказ</Badge>}
                </div>
              </TableCell>
              <TableCell className="text-right align-top tabular-nums">
                {rub.format(row.amount)}
              </TableCell>
              <TableCell className="align-top">
                {(row.receiptCount > 0 || row.receiptsExpected > 0) && (
                  <WorkshopReceiptsButton
                    orderId={row.id}
                    title={`${row.userName} · ${row.workshopTitle ?? row.workshopSlug}`}
                    count={row.receiptCount}
                    needed={row.receiptCount < row.receiptsExpected}
                    unsent={row.receiptsUnsent > 0}
                  />
                )}
              </TableCell>
              <TableCell className="align-top">
                {row.status === "paid" && row.hasBrief && (
                  <WorkshopBriefButton
                    orderId={row.id}
                    sentAt={row.briefSentAt}
                    buyer={row.contactEmail || row.userEmail}
                  />
                )}
              </TableCell>
              <TableCell className="align-top">
                <WorkshopOrderRemove
                  orderId={row.id}
                  title={`${row.userName} · ${row.workshopTitle ?? row.workshopSlug}`}
                  status={row.status}
                  paid={row.paidAt !== null}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
