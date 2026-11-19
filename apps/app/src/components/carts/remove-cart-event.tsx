"use client";

import { Button, toast } from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useConfirm } from "~/components/confirm-dialog";
import { orpc } from "~/orpc/react";

/** Удаляет одно событие из истории корзины; не осталось событий — уходит к списку. */
export function RemoveCartEvent({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const remove = useMutation({
    ...orpc.admin.carts.removeEvent.mutationOptions(),
    onSuccess: ({ remaining }) => {
      toast.success("Событие удалено");
      if (remaining === 0) router.replace("/carts");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не удалилось"),
  });

  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-destructive hover:text-destructive"
      disabled={remove.isPending}
      onClick={async () => {
        if (
          await confirm({
            title: "Удалить событие из истории?",
            description: `${label}. Состав корзины «сейчас» пересчитается по оставшимся событиям. Заказы не затрагиваются. Это нельзя отменить.`,
            confirmLabel: "Удалить",
            destructive: true,
          })
        ) {
          remove.mutate({ id });
        }
      }}
    >
      {remove.isPending ? "Удаляем…" : "Удалить"}
    </Button>
  );
}
