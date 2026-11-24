import type { MetrikaVisitRow } from "@stariva/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";

import { dateTime } from "~/components/crm/crm-meta";
import { deviceLabel, formatDuration, truncateUrl } from "./metrika-meta";

export type MetrikaVisitsTableRow = MetrikaVisitRow;

interface MetrikaVisitsTableProps {
  rows: MetrikaVisitsTableRow[];
}

export function MetrikaVisitsTable({ rows }: MetrikaVisitsTableProps) {
  return (
    <div className="rounded-lg border contain-inline-size">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Начало визита</TableHead>
            <TableHead>ClientID</TableHead>
            <TableHead>Визит</TableHead>
            <TableHead className="text-right">Стр.</TableHead>
            <TableHead className="text-right">Время</TableHead>
            <TableHead className="text-right">Отказ</TableHead>
            <TableHead>Источник</TableHead>
            <TableHead>Первый источник</TableHead>
            <TableHead>UTM</TableHead>
            <TableHead>Город</TableHead>
            <TableHead>Устройство</TableHead>
            <TableHead>Вход / Выход</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={12}
                className="text-muted-foreground py-8 text-center"
              >
                Визитов не найдено
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.visitId}>
              <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                {dateTime.format(row.startedAt)}
              </TableCell>
              <TableCell className="max-w-[140px] truncate text-sm font-medium">
                {row.clientId ?? "—"}
              </TableCell>
              <TableCell className="max-w-[140px] truncate text-sm">
                {row.visitId}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {row.pageViews ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatDuration(row.duration)}
              </TableCell>
              <TableCell className="text-right text-sm">
                {row.bounce ? "Да" : "—"}
              </TableCell>
              <TableCell className="max-w-[160px] truncate text-sm">
                {row.trafficSource ?? "—"}
              </TableCell>
              <TableCell className="max-w-[160px] truncate text-sm">
                {row.firstTrafficSource ?? "—"}
              </TableCell>
              <TableCell className="max-w-[180px] truncate text-sm">
                {[row.utmSource, row.utmCampaign].filter(Boolean).join(" / ") ||
                  "—"}
              </TableCell>
              <TableCell className="text-sm">{row.city ?? "—"}</TableCell>
              <TableCell className="text-sm">
                {deviceLabel(row.deviceCategory)}
              </TableCell>
              <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">
                {truncateUrl(row.startUrl, 40)} / {truncateUrl(row.endUrl, 40)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
