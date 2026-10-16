import { Card, CardDescription, CardHeader, CardTitle } from "@stariva/ui";
import type { ReactNode } from "react";

/** Карточка показателя сводки с подписью и необязательной подсказкой. */
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: string;
}) {
  return (
    <Card className="gap-0 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`text-2xl tabular-nums ${tone ?? ""}`}>
          {value}
        </CardTitle>
        {hint && (
          <p className="text-muted-foreground text-xs leading-snug">{hint}</p>
        )}
      </CardHeader>
    </Card>
  );
}
