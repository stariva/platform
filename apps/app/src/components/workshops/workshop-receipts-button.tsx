"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@stariva/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReceiptsPanel } from "~/components/orders/receipts-panel";

/** Чеки записи на мастер-класс — в диалоге прямо из таблицы заказов. */
export function WorkshopReceiptsButton({
  orderId,
  title,
  count,
  needed,
}: {
  orderId: string;
  title: string;
  count: number;
  /** Оплачено, а чека нет — кнопка заметнее. */
  needed: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant={needed ? "default" : "outline"}
        onClick={() => setOpen(true)}
      >
        {count > 0 ? `Чеки · ${count}` : needed ? "Добавить чек" : "Чек"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          // Число чеков в таблице считает сервер
          if (!next) router.refresh();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Чеки</DialogTitle>
            <DialogDescription>{title}</DialogDescription>
          </DialogHeader>
          <ReceiptsPanel target={{ kind: "workshop", orderId }} />
        </DialogContent>
      </Dialog>
    </>
  );
}
