"use client";

import { Button, toast } from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useConfirm } from "~/components/confirm-dialog";
import { orpc } from "~/orpc/react";

/**
 * Удаляет корзину целиком вместе с историей. С карточки корзины уходит к
 * списку, из списка остаётся на месте.
 */
export function RemoveCart({
  id,
  label,
  redirectTo,
}: {
  id: string;
  label: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const remove = useMutation({
    ...orpc.admin.carts.remove.mutationOptions(),
    onSuccess: () => {
      toast.success("Корзина удалена");
      if (redirectTo) router.replace(redirectTo);
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
            title: "Удалить корзину?",
            description: `${label}. Вся история корзины исчезнет из админки. Заказы не затрагиваются. Это нельзя отменить.`,
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
