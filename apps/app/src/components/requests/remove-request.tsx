"use client";

import { Button, toast } from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useConfirm } from "~/components/confirm-dialog";
import { orpc } from "~/orpc/react";

/** Удаляет заявку без заказа вместе с фото: спам, тесты, дубли. */
export function RemoveRequest({ number }: { number: number }) {
  const router = useRouter();
  const confirm = useConfirm();
  const remove = useMutation({
    ...orpc.admin.requests.remove.mutationOptions(),
    onSuccess: () => {
      toast.success("Заявка удалена");
      router.replace("/requests");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не удалилось"),
  });

  return (
    <Button
      size="sm"
      variant="destructive"
      disabled={remove.isPending}
      onClick={async () => {
        if (
          await confirm({
            title: `Удалить заявку №${number}?`,
            description:
              "Заявка исчезнет из списка и с доски заказов вместе с фото. Это нельзя отменить. Если заказа не будет, но историю нужно сохранить, отправьте её в архив.",
            confirmLabel: "Удалить",
            destructive: true,
          })
        ) {
          remove.mutate({ number });
        }
      }}
    >
      {remove.isPending ? "Удаляем…" : "Удалить"}
    </Button>
  );
}
