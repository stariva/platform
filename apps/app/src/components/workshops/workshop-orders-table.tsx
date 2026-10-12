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
  preorder: boolean;
  utmSource: string | null;
  utmCampaign: string | null;
}

/** Заказы мастер-классов: кто, на какой курс, когда и оплатил ли. */
export function WorkshopOrdersTable({
  rows,
  showWorkshop,
}: {
  rows: WorkshopOrderRow[];
  showWorkshop: boolean;
}) {
  const columns = showWorkshop ? 5 : 4;
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Кто</TableHead>
            {showWorkshop && <TableHead>Мастер-класс</TableHead>}
            <TableHead>Когда</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="text-right">Сумма</TableHead>
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
              <TableCell className="align-top text-sm whitespace-nowrap">
                {dateFormat.format(row.createdAt)}
                {row.paidAt && row.status === "paid" && (
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
