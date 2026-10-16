"use client";

import { Button, toast } from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useConfirm } from "~/components/confirm-dialog";
import { orpc } from "~/orpc/react";

const sentFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

const onError = (error: Error) =>
  toast.error(error.message || "Не удалось отправить бриф");

/** PDF-бриф одному покупателю: отправить или отправить ещё раз. */
export function WorkshopBriefButton({
  orderId,
  sentAt,
  buyer,
}: {
  orderId: string;
  sentAt: Date | null;
  /** Кому — для подтверждения повторной отправки. */
  buyer: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const send = useMutation({
    ...orpc.admin.workshops.sendBrief.mutationOptions(),
    onSuccess: ({ to }) => {
      toast.success(`Бриф отправлен на ${to}`);
      router.refresh();
    },
    onError,
  });

  async function resend() {
    if (
      await confirm({
        title: "Отправить бриф ещё раз?",
        description: `Бриф уже уходил покупателю (${buyer}). Придёт ещё одно письмо с PDF.`,
        confirmLabel: "Отправить",
      })
    ) {
      send.mutate({ orderId });
    }
  }

  if (!sentAt) {
    return (
      <Button
        size="sm"
        disabled={send.isPending}
        onClick={() => send.mutate({ orderId })}
      >
        {send.isPending ? "Отправляем…" : "Отправить бриф"}
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-muted-foreground text-xs whitespace-nowrap">
        отправлен {sentFormat.format(sentAt)}
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={send.isPending}
        onClick={resend}
      >
        {send.isPending ? "Отправляем…" : "Ещё раз"}
      </Button>
    </div>
  );
}

/** Бриф всем оплатившим курс, кому он ещё не уходил. */
export function WorkshopBriefBulk({
  workshop,
}: {
  workshop: { slug: string; title: string; briefMissing: number };
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const send = useMutation({
    ...orpc.admin.workshops.sendMissingBriefs.mutationOptions(),
    onSuccess: ({ sent, failed }) => {
      if (failed.length > 0) {
        toast.warning(
          `Отправлено: ${sent}. Не ушло: ${failed.join(", ")} — попробуйте ещё раз`,
        );
      } else {
        toast.success(`Бриф отправлен: ${sent}`);
      }
      router.refresh();
    },
    onError,
  });

  async function sendAll() {
    if (
      await confirm({
        title: `Отправить бриф «${workshop.title}»?`,
        description: `Письмо с PDF получат все оплатившие, кому бриф ещё не уходил: ${workshop.briefMissing}.`,
        confirmLabel: "Отправить",
      })
    ) {
      send.mutate({ workshop: workshop.slug });
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <span>
        PDF-бриф «{workshop.title}» не получили письмом:{" "}
        <b>{workshop.briefMissing}</b>
      </span>
      <Button size="sm" disabled={send.isPending} onClick={sendAll}>
        {send.isPending ? "Отправляем…" : "Отправить всем"}
      </Button>
    </div>
  );
}
