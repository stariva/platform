"use client";

import { Badge, Label, Switch, toast } from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { orpc } from "~/orpc/react";

interface Props {
  id: string;
  name: string;
  status: "draft" | "published" | "archived";
  madeToOrder: boolean;
  stockAvailable: number;
}

/** Переключатели «На сайте» и «Под заказ» прямо в строке таблицы товаров. */
export function AvailabilitySwitches({
  id,
  name,
  status,
  madeToOrder,
  stockAvailable,
}: Props) {
  const router = useRouter();
  const [published, setPublished] = useState(status === "published");
  const [toOrder, setToOrder] = useState(madeToOrder);

  const mutation = useMutation({
    ...orpc.admin.products.setAvailability.mutationOptions(),
    onSuccess: (result) => {
      setPublished(result.status === "published");
      setToOrder(result.madeToOrder);
      router.refresh();
    },
    onError: (error: Error) => {
      // Возвращаем переключатели к тому, что реально в базе
      setPublished(status === "published");
      setToOrder(madeToOrder);
      toast.error(error.message || "Не сохранилось");
    },
  });

  const archived = status === "archived" && !published;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm">
        <Switch
          id={`published-${id}`}
          size="sm"
          checked={published}
          disabled={mutation.isPending}
          aria-label={`На сайте: ${name}`}
          onCheckedChange={(checked) => {
            setPublished(checked);
            mutation.mutate({ id, published: checked });
          }}
        />
        <Label htmlFor={`published-${id}`} className="font-normal">
          {archived ? "В архиве" : "На сайте"}
        </Label>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Switch
          id={`made-to-order-${id}`}
          size="sm"
          checked={toOrder}
          disabled={mutation.isPending}
          aria-label={`Под заказ: ${name}`}
          onCheckedChange={(checked) => {
            setToOrder(checked);
            mutation.mutate({ id, madeToOrder: checked });
          }}
        />
        <Label htmlFor={`made-to-order-${id}`} className="font-normal">
          Под заказ
        </Label>
      </div>
      {stockAvailable > 0 ? (
        <Badge variant="default" className="w-fit">
          В наличии: {stockAvailable}
        </Badge>
      ) : (
        <span className="text-muted-foreground text-xs">Нет в наличии</span>
      )}
    </div>
  );
}
