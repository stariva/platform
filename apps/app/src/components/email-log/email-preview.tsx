"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@stariva/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "~/orpc/react";

/** Письмо в том виде, в каком его получил адресат: открывается по кнопке из таблицы. */
export function EmailPreview({
  id,
  subject,
  recipient,
}: {
  id: string;
  subject: string;
  recipient: string;
}) {
  const [open, setOpen] = useState(false);
  // Тело тянем только когда диалог открыт: в списке его нет
  const query = useQuery({
    ...orpc.admin.emailLog.html.queryOptions({ input: { id } }),
    enabled: open,
  });
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Показать письмо
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="break-words">{subject}</DialogTitle>
            <DialogDescription>Кому: {recipient}</DialogDescription>
          </DialogHeader>
          {query.isPending && (
            <p className="text-muted-foreground text-sm">Загружаю…</p>
          )}
          {query.isError && (
            <p className="text-destructive text-sm">
              Не получилось загрузить письмо
            </p>
          )}
          {query.data && (
            // Пустой sandbox: скрипты и переходы из письма не выполняются
            <iframe
              title={subject}
              srcDoc={query.data.html}
              sandbox=""
              referrerPolicy="no-referrer"
              className="h-[70vh] w-full rounded-md border bg-white"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
