"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button
      onClick={() => window.print()}
      className="bg-terracotta text-parchment hover:bg-terracotta-dark no-print"
    >
      Скачать / Распечатать
    </Button>
  );
}
