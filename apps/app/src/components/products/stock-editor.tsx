"use client";

import { Button, Input, Label, toast } from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { orpc } from "~/orpc/react";

interface Props {
  id: string;
  stockAvailable: number;
  sku: number | null;
  offerId: string | null;
}

/**
 * Остаток готовых изделий. Ведётся у нас, а не в Ozon: при оплате заказа он
 * списывается сам, пополнять его нужно здесь.
 */
export function StockEditor({ id, stockAvailable, sku, offerId }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(String(stockAvailable));
  const [saved, setSaved] = useState(stockAvailable);

  const mutation = useMutation({
    ...orpc.admin.products.setStock.mutationOptions(),
    onSuccess: (result) => {
      setSaved(result.stockAvailable);
      setValue(String(result.stockAvailable));
      toast.success("Остаток сохранён");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не сохранилось"),
  });

  const parsed = value.trim() === "" ? Number.NaN : Number(value);
  const changed = Number.isInteger(parsed) && parsed !== saved;

  return (
    <div className="bg-muted/50 space-y-2 rounded-md p-3 text-sm">
      <Label htmlFor="stockAvailable" className="font-medium">
        Готовых изделий в наличии
      </Label>
      <div className="flex gap-2">
        <Input
          id="stockAvailable"
          type="number"
          min="0"
          step="1"
          className="max-w-32"
          disabled={sku === null}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!changed || mutation.isPending}
          onClick={() => mutation.mutate({ id, stockAvailable: parsed })}
        >
          Сохранить остаток
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {sku
          ? `Ozon SKU ${sku}${offerId ? ` · артикул ${offerId}` : ""} — нужен только для доставки. `
          : "Нет SKU Ozon — продаётся только под заказ. "}
        Остаток уменьшается сам, когда заказ оплачен.
      </p>
    </div>
  );
}
