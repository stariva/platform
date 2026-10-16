"use client";

import { Button, toast } from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useConfirm } from "~/components/confirm-dialog";
import { orpc } from "~/orpc/react";

/** Удаляет запись на мастер-класс: спам, тесты, дубли, брошенные оплаты. */
export function WorkshopOrderRemove({
  orderId,
  title,
  status,
  paid,
}: {
  orderId: string;
  /** Кто и на что записан — для заголовка подтверждения. */
  title: string;
  status: "paid" | "pending" | "canceled" | "refunded";
  /** По записи принимали оплату. */
  paid: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const remove = useMutation({
    ...orpc.admin.workshops.removeOrder.mutationOptions(),
    onSuccess: () => {
      toast.success("Запись удалена");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не удалилось"),
  });

  // Без оговорок — только отменённая запись без оплаты, как и на сервере
  const safe = status === "canceled" && !paid;

  async function confirmRemove() {
    const risks = [
      status === "pending" &&
        "Запись ждёт оплаты: если покупатель заплатит по уже выданной ссылке, заказ не найдётся.",
      (status === "paid" || status === "refunded" || paid) &&
        "Пропадут история оплаты и чеки. Деньги это не вернёт.",
      status === "paid" &&
        "Доступ к курсу останется — закрыть его можно на странице пользователя.",
    ].filter((risk): risk is string => Boolean(risk));

    const confirmed = await confirm({
      title: `Удалить запись: ${title}?`,
      description: (
        <>
          <p>Это нельзя отменить.</p>
          {risks.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {risks.map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ul>
          )}
        </>
      ),
      confirmLabel: "Удалить",
      destructive: true,
    });
    if (confirmed) remove.mutate({ id: orderId, force: !safe });
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
