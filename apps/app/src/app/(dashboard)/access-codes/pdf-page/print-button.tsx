"use client";

import { Button } from "@stariva/ui";

export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      Сохранить в PDF
    </Button>
  );
}
