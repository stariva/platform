"use client";

import { Button, toast } from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { orpc } from "~/orpc/react";

/**
 * «Сформировать чек» для оплаченного Boosty-заказа: регистрирует доход в
 * «Мой налог», как сайт делает сам при оплате ЮKassa. Нужна для старых
 * заказов и когда автоматическая выписка не сработала.
 */
export function BoostyReceiptButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const issue = useMutation({
    ...orpc.admin.workshops.issueBoostyReceipt.mutationOptions(),
    onSuccess: ({ issued }) => {
      if (issued) {
        toast.success(
          "Чек сформирован в «Мой налог». Проверьте его и отправьте покупателю.",
        );
      } else {
        toast.warning(
          "Чек сформировать не удалось — витрина недоступна. Привяжите чек ссылкой в панели чеков.",
        );
      }
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={issue.isPending}
      onClick={() => issue.mutate({ id: orderId })}
    >
      {issue.isPending ? "Формируем…" : "Сформировать чек"}
    </Button>
  );
}
