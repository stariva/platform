import type { MetrikaGoalRow } from "@stariva/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";

import { dateTime } from "~/components/crm/crm-meta";

export type MetrikaGoalsTableRow = MetrikaGoalRow;

interface MetrikaGoalsTableProps {
  rows: MetrikaGoalsTableRow[];
}

export function MetrikaGoalsTable({ rows }: MetrikaGoalsTableProps) {
  return (
    <div className="rounded-lg border contain-inline-size">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Название</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Синхронизировано</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-muted-foreground py-8 text-center"
              >
                Целей не найдено
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="text-muted-foreground text-sm">
                {row.id}
              </TableCell>
              <TableCell className="font-medium text-sm">{row.name}</TableCell>
              <TableCell className="text-sm">{row.type}</TableCell>
              <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                {dateTime.format(row.syncedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
