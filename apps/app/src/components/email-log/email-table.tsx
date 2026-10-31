import type { EmailLogRow } from "@stariva/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import { Badge } from "@stariva/ui/reui";
import Link from "next/link";
import { dateTime } from "~/components/crm/crm-meta";
import { duration, kindLabel, providerLabel } from "./email-meta";
import { EmailPreview } from "./email-preview";

/** Строка журнала без тела письма: оно открывается отдельно, по кнопке. */
export type EmailRow = Omit<EmailLogRow, "html"> & { hasHtml: boolean };

/** Что случилось с письмом: ушло сразу, ушло с запасного канала или не ушло. */
function StatusBadge({ row }: { row: EmailRow }) {
  if (row.status === "failed") {
    return <Badge variant="destructive-light">Не ушло</Badge>;
  }
  return row.attempts.length > 1 ? (
    <Badge variant="warning-light">Ушло с запасного</Badge>
  ) : (
    <Badge variant="success-light">Отправлено</Badge>
  );
}

/** Таблица писем: когда, кому, какое, чем кончилось и что отвечал каждый провайдер. */
export function EmailTable({ rows }: { rows: EmailRow[] }) {
  return (
    <div className="rounded-lg border contain-inline-size">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Когда</TableHead>
            <TableHead>Кому</TableHead>
            <TableHead>Письмо</TableHead>
            <TableHead>Итог</TableHead>
            <TableHead>Попытки отправки</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-muted-foreground py-8 text-center"
              >
                За этот период писем нет
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => {
            const kind = kindLabel(row.kind);
            return (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                  {dateTime.format(row.createdAt)}
                </TableCell>
                <TableCell className="max-w-[220px] text-sm break-words whitespace-normal">
                  {row.recipient}
                </TableCell>
                <TableCell className="max-w-[320px] text-sm whitespace-normal">
                  <div className="break-words">{row.subject}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {kind && <Badge variant="outline">{kind}</Badge>}
                    {row.attachments > 0 && (
                      <span className="text-muted-foreground text-xs">
                        Вложений: {row.attachments}
                      </span>
                    )}
                    {row.workshopOrderId && (
                      <Link
                        href={`/workshop-orders?status=all&q=${encodeURIComponent(row.workshopOrderId)}`}
                        className="text-muted-foreground text-xs hover:underline"
                      >
                        Заказ мастер-класса
                      </Link>
                    )}
                  </div>
                  <div className="mt-2">
                    {row.hasHtml ? (
                      <EmailPreview
                        id={row.id}
                        subject={row.subject}
                        recipient={row.recipient}
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Тело письма не сохранено: письмо отправлено до появления
                        просмотра
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm whitespace-normal">
                  <StatusBadge row={row} />
                  <div className="text-muted-foreground mt-1 text-xs">
                    {row.status === "sent"
                      ? `Принял ${providerLabel(row.provider)}`
                      : "Письмо не принял ни один провайдер"}
                  </div>
                </TableCell>
                <TableCell className="max-w-[360px] text-sm whitespace-normal">
                  <ol className="space-y-1">
                    {row.attempts.map((attempt, index) => (
                      <li
                        // Попытки идут по порядку и не меняются
                        // biome-ignore lint/suspicious/noArrayIndexKey: порядок и есть идентификатор
                        key={index}
                        className="text-xs"
                      >
                        <span
                          className={
                            attempt.ok
                              ? "font-medium text-green-700 dark:text-green-400"
                              : "font-medium text-red-700 dark:text-red-400"
                          }
                        >
                          {providerLabel(attempt.provider)}
                          {attempt.ok ? " — принял" : " — отказал"}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {duration(attempt.ms)}
                        </span>
                        {attempt.error && (
                          <div className="text-muted-foreground break-words">
                            {attempt.error}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
