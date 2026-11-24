"use client";

import { Button, toast } from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { orpc } from "~/orpc/react";

/**
 * Кнопка «Создать отправления Ozon» на странице заказов: просит витрину
 * догнать заказы под заказ после сбоя Ozon Доставки. Крон за заказами
 * больше не следит — когда мастер починила ключи, она жмёт кнопку сама.
 */
export function OzonDeliverySweepButton() {
  const router = useRouter();
  const sweep = useMutation({
    ...orpc.admin.orders.sweepOzonDeliveries.mutationOptions(),
    onSuccess: (result) => {
      if (!result.ran) {
        toast.error(
          "Витрина не ответила — проверьте её настройки и попробуйте ещё раз",
        );
        return;
      }
      const done = [
        `проверено ${result.checked}`,
        result.repriced > 0 && `цены пересчитаны ${result.repriced}`,
        result.shipped > 0 && `отправлений создано ${result.shipped}`,
        result.failed > 0 && `не вышло ${result.failed}`,
      ]
        .filter(Boolean)
        .join(", ");
      toast.success(`Ozon-доставка: ${done}`);
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Прогон не удался"),
  });

  return (
    <Button
      variant="outline"
      onClick={() => sweep.mutate()}
      disabled={sweep.isPending}
      className="shrink-0"
    >
      {sweep.isPending ? "Прогоняю…" : "Создать отправления Ozon"}
    </Button>
  );
}
