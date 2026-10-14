"use client";

import { Button, toast } from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useConfirm } from "~/components/confirm-dialog";
import { orpc } from "~/orpc/react";

/** Удаляет карточку с ручными продажами; заказы с сайта остаются. */
export function RemoveClient({
  id,
  name,
  hasSiteOrders,
}: {
  id: string;
  name: string;
  hasSiteOrders: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const remove = useMutation({
    ...orpc.admin.crm.removeClient.mutationOptions(),
    onSuccess: () => {
      toast.success("Карточка удалена");
      router.replace("/crm/clients");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не удалилось"),
  });

  return (
    <Button
      variant="destructive"
      className="w-full"
      disabled={remove.isPending}
      onClick={async () => {
        if (
          await confirm({
            title: `Удалить карточку «${name}»?`,
            description: hasSiteOrders
              ? "Удалятся заметки, источник, указанный вручную, и продажи, добавленные вручную. Заказы с сайта останутся, и клиент по ним будет в списке."
              : "Удалятся заметки и продажи, добавленные вручную. Это нельзя отменить.",
            confirmLabel: "Удалить",
            destructive: true,
          })
        ) {
          remove.mutate({ id });
        }
      }}
    >
      {remove.isPending ? "Удаляем…" : "Удалить карточку"}
    </Button>
  );
}
