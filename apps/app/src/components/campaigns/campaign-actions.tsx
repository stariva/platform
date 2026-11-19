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
import { useDraftState } from "./draft-state";

/** Окно с письмом, как его увидит получатель. */
export function EmailPreviewDialog({
  open,
  onOpenChange,
  subject,
  description,
  query,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  description: string;
  query: { isPending: boolean; isError: boolean; data?: { html: string } };
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="break-words">{subject}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
  );
}

/** Сохранённая рассылка, как её увидит получатель: открывается по кнопке. */
export function CampaignPreview({
  id,
  subject,
}: {
  id: string;
  subject: string;
}) {
  const [open, setOpen] = useState(false);
  // Без кеша: после сохранения правок окно должно показать новую версию
  const query = useQuery({
    ...orpc.admin.campaigns.preview.queryOptions({ input: { id } }),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
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
      <EmailPreviewDialog
        open={open}
        onOpenChange={setOpen}
        subject={subject}
        description="Так письмо увидит получатель. Последние сохранённые правки."
        query={query}
      />
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
  /** Некому слать. */
  disabled?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  // Уйдёт сохранённая версия: с несохранёнными правками отправлять нельзя
  const dirty = useDraftState()?.dirty ?? false;
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
    <div className="space-y-1.5">
      <Button
        className="w-full"
        disabled={disabled || dirty || start.isPending}
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
      {dirty && (
        <p className="text-muted-foreground text-xs">
          Сначала сохраните правки — уйдёт сохранённая версия письма
        </p>
      )}
    </div>
  );
}

/**
 * Удаляет рассылку. У запущенной вместе с ней пропадают получатели и история,
 * а ссылки отписки в ушедших письмах перестают работать, поэтому текст
 * подтверждения об этом предупреждает.
 */
export function RemoveCampaign({
  id,
  name,
  status,
  compact,
}: {
  id: string;
  name: string;
  status: "draft" | "sending" | "sent";
  /** Кнопка поменьше, для строки списка. */
  compact?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const draft = status === "draft";
  const remove = useMutation({
    ...orpc.admin.campaigns.remove.mutationOptions(),
    onSuccess: () => {
      toast.success(draft ? "Черновик удалён" : "Рассылка удалена");
      router.replace("/campaigns");
      router.refresh();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Не удалилось");
      router.refresh();
    },
  });
  return (
    <Button
      variant="ghost"
      size={compact ? "sm" : "default"}
      className={compact ? "text-destructive" : "text-destructive w-full"}
      disabled={remove.isPending}
      onClick={async () => {
        if (
          await confirm({
            title: draft
              ? `Удалить черновик «${name}»?`
              : `Удалить рассылку «${name}»?`,
            description: draft
              ? undefined
              : `Пропадут получатели и вся статистика. Ссылки «Отписаться» и кнопки в уже ушедших письмах перестанут работать${
                  status === "sending"
                    ? ", а письма, которые ещё не ушли, отправлены не будут"
                    : ""
                }. Отменить это нельзя.`,
            confirmLabel: "Удалить",
            destructive: true,
          })
        ) {
          remove.mutate({ id });
        }
      }}
    >
      {draft ? "Удалить черновик" : "Удалить"}
    </Button>
  );
}
