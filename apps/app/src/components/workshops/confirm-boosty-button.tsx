"use client";

import { Button, toast } from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { orpc } from "~/orpc/react";

export function ConfirmBoostyButton({ id }: { id: string }) {
  const router = useRouter();
  const confirm = useMutation({
    ...orpc.admin.workshops.confirmBoosty.mutationOptions(),
    onSuccess: ({ notified }) => {
      toast.success(
        notified
          ? "Доступ выдан, письмо отправлено"
          : "Доступ выдан. Письмо не отправилось — повторите действие в заказе.",
      );
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={confirm.isPending}
      onClick={() => {
        if (
          window.confirm(
            "Вы проверили оплату этого поста в Boosty для email покупателя?",
          )
        )
          confirm.mutate({ id });
      }}
    >
      {confirm.isPending ? "Подтверждаем…" : "Оплата проверена"}
    </Button>
  );
}
