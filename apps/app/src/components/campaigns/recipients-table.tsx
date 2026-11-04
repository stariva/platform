import type {
  EmailRecipientSource,
  EmailRecipientStatus,
} from "@stariva/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import { Badge } from "@stariva/ui/reui";
import { dateTime } from "~/components/crm/crm-meta";
import { RECIPIENT_STATUS_LABELS } from "./campaign-meta";

export interface RecipientRow {
  id: string;
  email: string;
  source: EmailRecipientSource;
  status: EmailRecipientStatus;
  error: string | null;
  attempts: number;
  sentAt: Date | null;
  firstOpenedAt: Date | null;
  openCount: number;
  firstClickedAt: Date | null;
  clickCount: number;
  unsubscribedAt: Date | null;
}

const STATUS_VARIANTS = {
  queued: "secondary",
  sent: "success-light",
  failed: "destructive-light",
  skipped: "warning-light",
} as const;

/** «2 раза», «5 раз», «22 раза». */
function times(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
    ? "раза"
    : "раз";
}

/** Когда и сколько раз: «3 нояб., 18:40 · 2 раза». */
function Moment({ at, count }: { at: Date | null; count?: number }) {
  if (!at) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="whitespace-nowrap">
      {dateTime.format(at)}
      {count !== undefined && count > 1 && (
        <span className="text-muted-foreground">
          {" "}
          · {count} {times(count)}
        </span>
      )}
    </span>
  );
}

/** Получатели рассылки: ушло ли письмо, открыли ли, перешли ли, отписались ли. */
export function RecipientsTable({ rows }: { rows: RecipientRow[] }) {
  return (
    <div className="rounded-lg border contain-inline-size">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Кому</TableHead>
            <TableHead>Письмо</TableHead>
            <TableHead>Открыл</TableHead>
            <TableHead>Перешёл по кнопке</TableHead>
            <TableHead>Отписался</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-muted-foreground py-8 text-center"
              >
                Получателей пока нет: они появятся после запуска
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-[260px] text-sm break-words whitespace-normal">
                {row.email}
                {row.source === "manual" && (
                  <div className="mt-1">
                    <Badge variant="outline">вручную</Badge>
                  </div>
                )}
              </TableCell>
              <TableCell className="max-w-[320px] text-sm whitespace-normal">
                <Badge variant={STATUS_VARIANTS[row.status]}>
                  {RECIPIENT_STATUS_LABELS[row.status]}
                </Badge>
                <div className="text-muted-foreground mt-1 text-xs">
                  {row.sentAt
                    ? dateTime.format(row.sentAt)
                    : row.attempts > 0
                      ? `Попыток: ${row.attempts}`
                      : null}
                </div>
                {row.status === "failed" && row.error && (
                  <div className="text-muted-foreground mt-1 text-xs break-words">
                    {row.error}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-sm">
                <Moment at={row.firstOpenedAt} count={row.openCount} />
              </TableCell>
              <TableCell className="text-sm">
                <Moment at={row.firstClickedAt} count={row.clickCount} />
              </TableCell>
              <TableCell className="text-sm">
                <Moment at={row.unsubscribedAt} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
