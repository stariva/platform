"use client";

import { Button, Checkbox, Input, Label, toast } from "@stariva/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useConfirm } from "~/components/confirm-dialog";
import { orpc } from "~/orpc/react";
import { dateTime } from "./order-meta";

type Target = Parameters<typeof orpc.admin.receipts.forOrder.call>[0];

/**
 * Чеки НПД заказа: Ольга вставляет ссылку на чек из «Мой налог», сайт
 * проверяет его в ФНС и отправляет покупателю письмом.
 */
export function ReceiptsPanel({ target }: { target: Target }) {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [link, setLink] = useState("");
  const [send, setSend] = useState(true);
  // Раскрытые картинки чеков; без явного выбора раскрыт неотправленный —
  // его Ольга смотрит перед отправкой
  const [previews, setPreviews] = useState<Record<string, boolean>>({});

  const query = useQuery(
    orpc.admin.receipts.forOrder.queryOptions({ input: target }),
  );
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: orpc.admin.receipts.forOrder.key({ input: target }),
    });
  const onError = (error: Error) =>
    toast.error(error.message || "Не получилось");

  const attach = useMutation({
    ...orpc.admin.receipts.attach.mutationOptions(),
    onSuccess: ({ receipt, emailError }) => {
      setLink("");
      if (emailError) toast.warning(`Чек привязан. ${emailError}`);
      else if (receipt.emailedTo)
        toast.success(`Чек отправлен на ${receipt.emailedTo}`);
      else toast.success("Чек привязан");
      return refresh();
    },
    onError,
  });
  const resend = useMutation({
    ...orpc.admin.receipts.send.mutationOptions(),
    onSuccess: (receipt) => {
      toast.success(`Чек отправлен на ${receipt.emailedTo}`);
      return refresh();
    },
    onError,
  });
  const remove = useMutation({
    ...orpc.admin.receipts.remove.mutationOptions(),
    onSuccess: () => {
      toast.success("Чек отвязан");
      return refresh();
    },
    onError,
  });

  if (query.isPending) {
    return <p className="text-muted-foreground text-sm">Загружаем чеки…</p>;
  }
  if (query.isError) {
    return (
      <p className="text-destructive text-sm">
        Не удалось загрузить чеки: {query.error.message}
      </p>
    );
  }
  const { to, receipts, expected } = query.data;
  const unsent = receipts.filter((receipt) => !receipt.emailedAt).length;

  async function confirmRemove(id: string, number: string) {
    if (
      await confirm({
        title: `Отвязать чек №${number}?`,
        description:
          "Чек пропадёт из заказа, но останется в «Мой налог». Если он выписан по ошибке, аннулируйте его там.",
        confirmLabel: "Отвязать",
        destructive: true,
      })
    ) {
      remove.mutate({ id });
    }
  }

  return (
    <div className="space-y-4">
      {receipts.length < expected && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Оплат: {expected}, чеков: {receipts.length}. Добавьте чек на
          оставшуюся оплату.
        </p>
      )}
      {unsent > 0 && to && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {unsent === 1
            ? "Чек привязан, но покупателю не отправлен."
            : `Чеков не отправлено покупателю: ${unsent}.`}{" "}
          Проверьте чек и нажмите «Отправить».
        </p>
      )}
      {receipts.length > 0 && (
        <ul className="space-y-2">
          {receipts.map((receipt) => {
            const preview = previews[receipt.id] ?? !receipt.emailedAt;
            return (
              <li
                key={receipt.id}
                className="space-y-3 rounded-lg border p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <a
                      href={receipt.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      Чек №{receipt.number} ↗
                    </a>
                    <p className="text-muted-foreground text-xs break-all">
                      {receipt.emailedAt
                        ? `отправлен на ${receipt.emailedTo} · ${dateTime.format(new Date(receipt.emailedAt))}`
                        : "покупателю не отправлен"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setPreviews((current) => ({
                          ...current,
                          [receipt.id]: !preview,
                        }))
                      }
                    >
                      {preview ? "Скрыть" : "Посмотреть"}
                    </Button>
                    {to && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resend.isPending}
                        onClick={() => resend.mutate({ id: receipt.id })}
                      >
                        {receipt.emailedAt ? "Ещё раз" : "Отправить"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={remove.isPending}
                      onClick={() => confirmRemove(receipt.id, receipt.number)}
                    >
                      Отвязать
                    </Button>
                  </div>
                </div>
                {preview && (
                  <a
                    href={receipt.url}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-muted/40 block max-h-[60vh] overflow-y-auto rounded-md border"
                  >
                    {/* biome-ignore lint/performance/noImgElement: картинка чека из бакета или с сервиса ФНС, без оптимизации */}
                    <img
                      src={receipt.url}
                      alt={`Чек №${receipt.number}`}
                      className="mx-auto w-full max-w-sm"
                    />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          attach.mutate({ ...target, link, send: Boolean(to) && send });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor={`receipt-link-${target.orderId}`}>
            {receipts.length > 0 ? "Ещё один чек" : "Ссылка на чек"}
          </Label>
          <Input
            id={`receipt-link-${target.orderId}`}
            value={link}
            maxLength={500}
            inputMode="url"
            placeholder="https://lknpd.nalog.ru/api/v1/receipt/…/print"
            onChange={(event) => setLink(event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            В «Мой налог» откройте чек, нажмите «Поделиться» и скопируйте
            ссылку. Сайт проверит чек в ФНС.
          </p>
        </div>
        {to ? (
          <Label className="flex items-center gap-2 text-sm font-normal">
            <Checkbox
              checked={send}
              onCheckedChange={(checked) => setSend(checked)}
            />
            Сразу отправить покупателю на {to}
          </Label>
        ) : (
          <p className="text-muted-foreground text-xs">
            У покупателя нет email — чек сохранится в заказе, отправьте его
            покупателю сами.
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={!link.trim() || attach.isPending}
        >
          {attach.isPending
            ? "Проверяем чек…"
            : to && send
              ? "Привязать и отправить"
              : "Привязать чек"}
        </Button>
      </form>
    </div>
  );
}
