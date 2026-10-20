"use client";

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "~/components/confirm-dialog";
import { orpc } from "~/orpc/react";

/**
 * Текст для чата заказа на Ярмарке. Ссылки там запрещены — только код,
 * а адрес страницы и QR покупатель найдёт на последней странице PDF.
 */
export function accessCodeMessage(code: string): string {
  return `Спасибо за покупку! Код для видеоуроков: ${code}. Как его ввести — на последней странице PDF.`;
}

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("Не удалось скопировать — выделите текст вручную");
  }
}

/** Выдать код покупателю с Ярмарки и сразу скопировать сообщение для чата. */
export function AccessCodeIssue({
  workshops,
  defaultWorkshop,
}: {
  workshops: { slug: string; title: string; price: number }[];
  defaultWorkshop?: string;
}) {
  const router = useRouter();
  const [workshop, setWorkshop] = useState(
    defaultWorkshop ?? workshops[0]?.slug ?? "",
  );
  const [note, setNote] = useState("");
  const [issued, setIssued] = useState<{ code: string; title: string } | null>(
    null,
  );
  const titles = Object.fromEntries(workshops.map((w) => [w.slug, w.title]));

  const issue = useMutation({
    ...orpc.admin.workshops.issueAccessCode.mutationOptions(),
    onSuccess: async ({ code }) => {
      setIssued({ code, title: titles[workshop] ?? workshop });
      setNote("");
      router.refresh();
      await copy(
        accessCodeMessage(code),
        `Код ${code} скопирован с сообщением`,
      );
    },
    onError: (error: Error) =>
      toast.error(error.message || "Не удалось выдать код"),
  });

  if (workshops.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Сначала добавьте мастер-класс — коды выдаются к нему.
      </p>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="access-code-workshop">Мастер-класс</Label>
          <Select
            value={workshop}
            onValueChange={(value) => {
              if (value) setWorkshop(value);
            }}
          >
            <SelectTrigger id="access-code-workshop" className="w-full">
              <SelectValue>
                {(value: string) => titles[value] ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {workshops.map((w) => (
                <SelectItem key={w.slug} value={w.slug}>
                  {w.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="access-code-note">
            Заказ на Ярмарке (необязательно)
          </Label>
          <Input
            id="access-code-note"
            maxLength={200}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Номер заказа или имя покупателя"
          />
        </div>
        <Button
          disabled={!workshop || issue.isPending}
          onClick={() =>
            issue.mutate({ workshopSlug: workshop, note: note || undefined })
          }
        >
          {issue.isPending ? "Выдаём…" : "Выдать код"}
        </Button>
      </div>

      {issued && (
        <div className="space-y-3 rounded-md bg-muted p-4">
          <p className="text-muted-foreground text-sm">
            Код к «{issued.title}». Сообщение уже скопировано — вставьте его в
            чат заказа на Ярмарке:
          </p>
          <p className="font-mono text-3xl tracking-widest">{issued.code}</p>
          <p className="rounded border bg-background p-3 text-sm">
            {accessCodeMessage(issued.code)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                copy(accessCodeMessage(issued.code), "Сообщение скопировано")
              }
            >
              Скопировать сообщение
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy(issued.code, "Код скопирован")}
            >
              Только код
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Удаляет неактивированный код: выдан по ошибке или заказ отменили. */
export function AccessCodeRemove({ id, code }: { id: string; code: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const remove = useMutation({
    ...orpc.admin.workshops.removeAccessCode.mutationOptions(),
    onSuccess: () => {
      toast.success("Код удалён");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не удалился"),
  });

  async function confirmRemove() {
    if (
      await confirm({
        title: `Удалить код ${code}?`,
        description:
          "Покупатель больше не сможет его активировать. Если код уже отправлен, выдайте новый.",
        confirmLabel: "Удалить",
        destructive: true,
      })
    ) {
      remove.mutate({ id });
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="text-destructive"
      disabled={remove.isPending}
      onClick={confirmRemove}
    >
      {remove.isPending ? "Удаляем…" : "Удалить"}
    </Button>
  );
}

/** Скопировать сообщение с уже выданным кодом ещё раз. */
export function AccessCodeCopy({ code }: { code: string }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => copy(accessCodeMessage(code), "Сообщение скопировано")}
    >
      Скопировать
    </Button>
  );
}
