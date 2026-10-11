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

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

export interface RequestRow {
  number: number;
  name: string | null;
  contact: string | null;
  description: string | null;
  productType: string | null;
  hasPhoto: boolean;
  createdAt: Date;
  deliveredAt: Date | null;
}

/** Метка, если уведомление о заявке так и не дошло в Telegram или на почту. */
export function DeliveryBadge({ deliveredAt }: { deliveredAt: Date | null }) {
  if (deliveredAt) return null;
  return <Badge variant="destructive">Уведомление не дошло</Badge>;
}

/** Таблица заявок с сайта, свежие сверху. */
export function RequestsTable({ rows }: { rows: RequestRow[] }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>№</TableHead>
            <TableHead>Что хотят</TableHead>
            <TableHead>Кто</TableHead>
            <TableHead>Когда</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-muted-foreground py-8 text-center"
              >
                Заявок нет
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.number}>
              <TableCell className="align-top font-medium tabular-nums">
                <Link
                  href={`/requests/${row.number}`}
                  className="hover:underline"
                >
                  №{row.number}
                </Link>
              </TableCell>
              <TableCell className="max-w-[480px] align-top whitespace-normal">
                <Link
                  href={`/requests/${row.number}`}
                  className="line-clamp-2 text-sm hover:underline"
                >
                  {row.description ?? "Без описания"}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {row.productType && (
                    <Badge variant="secondary">{row.productType}</Badge>
                  )}
                  {row.hasPhoto && <Badge variant="outline">есть фото</Badge>}
                  <DeliveryBadge deliveredAt={row.deliveredAt} />
                </div>
              </TableCell>
              <TableCell className="align-top text-sm">
                {row.name ?? <span className="text-muted-foreground">—</span>}
                <div className="text-muted-foreground text-xs break-all">
                  {row.contact}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground align-top text-sm whitespace-nowrap">
                {dateFormat.format(row.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
