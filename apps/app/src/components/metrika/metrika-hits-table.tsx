import type { MetrikaHitRow } from "@stariva/db/schema";
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";

import { dateTime } from "~/components/crm/crm-meta";
import { truncateUrl } from "./metrika-meta";

export type MetrikaHitsTableRow = MetrikaHitRow;

interface MetrikaHitsTableProps {
  rows: MetrikaHitsTableRow[];
}

export function MetrikaHitsTable({ rows }: MetrikaHitsTableProps) {
  return (
    <div className="rounded-lg border contain-inline-size">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Время</TableHead>
            <TableHead>ClientID</TableHead>
            <TableHead>Визит</TableHead>
            <TableHead>Страница / Событие</TableHead>
            <TableHead>Заголовок</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Цели</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-muted-foreground py-8 text-center"
              >
                Событий не найдено
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.watchId}>
              <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                {dateTime.format(row.at)}
              </TableCell>
              <TableCell className="max-w-[140px] truncate text-sm font-medium">
                {row.clientId ?? "—"}
              </TableCell>
              <TableCell className="max-w-[140px] truncate text-sm">
                {row.visitId ?? "—"}
              </TableCell>
              <TableCell className="max-w-[300px] truncate text-sm">
                {truncateUrl(row.url, 70)}
              </TableCell>
              <TableCell className="max-w-[240px] truncate text-sm">
                {row.title ?? "—"}
              </TableCell>
              <TableCell className="text-sm">
                {row.isPageView ? (
                  <Badge variant="outline">Просмотр</Badge>
                ) : (
                  <Badge variant="secondary">Событие</Badge>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {row.goalIds && row.goalIds.length > 0
                  ? row.goalIds.join(", ")
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
