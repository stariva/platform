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
import {
  type DeliveryFacts,
  deliveryState,
  times,
} from "~/components/email-log/email-meta";
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

/** Получатель и что Postbox сообщил о его письме. */
export type RecipientWithDelivery = RecipientRow & DeliveryFacts;

const STATUS_VARIANTS = {
  queued: "secondary",
  sent: "success-light",
  failed: "destructive-light",
  skipped: "warning-light",
} as const;

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

/** Доставка письма по событиям Postbox: доставлено, не доставлено, жалоба. */
function Delivery({ row }: { row: RecipientWithDelivery }) {
  const state = row.status === "sent" ? deliveryState(row) : null;
  if (!state) return null;
  return (
    <div className="mt-2">
      <Badge variant={state.variant}>{state.label}</Badge>
      {state.detail && (
        <div className="text-muted-foreground mt-1 text-xs break-words">
          {state.detail}
        </div>
      )}
    </div>
  );
}

/** Получатели рассылки: ушло ли письмо, открыли ли, перешли ли, отписались ли. */
export function RecipientsTable({ rows }: { rows: RecipientWithDelivery[] }) {
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
                <Delivery row={row} />
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
