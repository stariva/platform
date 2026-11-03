"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  toast,
} from "@stariva/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "~/components/confirm-dialog";
import { orpc } from "~/orpc/react";

/** Письмо, как его увидит получатель: открывается по кнопке. */
export function CampaignPreview({
  id,
  subject,
}: {
  id: string;
  subject: string;
}) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    ...orpc.admin.campaigns.preview.queryOptions({ input: { id } }),
    enabled: open,
  });
  return (
    <>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        Посмотреть письмо
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="break-words">{subject}</DialogTitle>
            <DialogDescription>
              Так письмо увидит получатель. Последние сохранённые правки.
            </DialogDescription>
          </DialogHeader>
          {query.isPending && (
            <p className="text-muted-foreground text-sm">Загружаю…</p>
          )}
          {query.isError && (
            <p className="text-destructive text-sm">
              Не получилось показать письмо
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

/** Пробное письмо: по умолчанию на свою почту. */
export function SendTest({ id }: { id: string }) {
  const [to, setTo] = useState("");
  const send = useMutation({
    ...orpc.admin.campaigns.sendTest.mutationOptions(),
    onSuccess: (result) => toast.success(`Пробное письмо ушло на ${result.to}`),
    onError: (error: Error) => toast.error(error.message || "Не отправилось"),
  });
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        send.mutate({ id, to: to.trim() || undefined });
      }}
    >
      <Label htmlFor="campaign-test-to">Пробное письмо</Label>
      <div className="flex gap-2">
        <Input
          id="campaign-test-to"
          type="email"
          placeholder="Пусто — на вашу почту"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
        <Button type="submit" variant="outline" disabled={send.isPending}>
          {send.isPending ? "Шлём…" : "Отправить"}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        В теме будет «[Тест]», переходы и отписка из него не засчитываются.
      </p>
    </form>
  );
}

/** Запуск рассылки: после него письмо уже не поменять. */
export function StartCampaign({
  id,
  name,
  recipients,
  disabled,
}: {
  id: string;
  name: string;
  recipients: number;
  /** Есть несохранённые правки или некому слать. */
  disabled?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const start = useMutation({
    ...orpc.admin.campaigns.start.mutationOptions(),
    onSuccess: (result) => {
      const left = result.recipients - result.sent - result.skipped;
      toast.success(
        left > 0
          ? `Ушло ${result.sent} из ${result.recipients}, остальные дошлю в фоне`
          : `Рассылка ушла: ${result.sent} писем`,
      );
      router.refresh();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Не запустилась");
      router.refresh();
    },
  });
  return (
    <Button
      className="w-full"
      disabled={disabled || start.isPending}
      onClick={async () => {
        if (
          await confirm({
            title: `Отправить «${name}»?`,
            description: `Письмо уйдёт ${recipients} получателям. После запуска его уже не изменить и не отменить.`,
            confirmLabel: "Отправить",
          })
        ) {
          start.mutate({ id });
        }
      }}
    >
      {start.isPending ? "Отправляю…" : "Отправить рассылку"}
    </Button>
  );
}

/** Удаляет черновик. */
export function RemoveCampaign({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const remove = useMutation({
    ...orpc.admin.campaigns.remove.mutationOptions(),
    onSuccess: () => {
      toast.success("Черновик удалён");
      router.replace("/campaigns");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не удалилось"),
  });
  return (
    <Button
      variant="ghost"
      className="text-destructive w-full"
      disabled={remove.isPending}
      onClick={async () => {
        if (
          await confirm({
            title: `Удалить черновик «${name}»?`,
            confirmLabel: "Удалить",
            destructive: true,
          })
        ) {
          remove.mutate({ id });
        }
      }}
    >
      Удалить черновик
    </Button>
  );
}
