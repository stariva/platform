"use client";

import { Button, Input, Label, Switch, toast } from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { orpc } from "~/orpc/react";

interface Props {
  id: string;
  stockAvailable: number;
  sku: number | null;
  offerId: string | null;
  sellOnOzon: boolean;
}

/**
 * Остаток готовых изделий. Ведётся у нас: при оплате заказа он списывается
 * сам, пополнять его нужно здесь. При сохранении дублируется на склад Ozon —
 * Ozon Доставка отгружает только то, что числится в остатке на Ozon.
 *
 * Готовые изделия с витрины Ozon скрыты; переключатель «Продавать на Ozon»
 * выставляет товар и туда. Остаток тогда общий: покупки на Ozon уменьшают
 * его на сайте сами, раз в несколько минут.
 */
export function StockEditor({
  id,
  stockAvailable,
  sku,
  offerId,
  sellOnOzon,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(String(stockAvailable));
  const [saved, setSaved] = useState(stockAvailable);
  const [syncFailed, setSyncFailed] = useState(false);
  const [onOzon, setOnOzon] = useState(sellOnOzon);

  const mutation = useMutation({
    ...orpc.admin.products.setStock.mutationOptions(),
    onSuccess: (result) => {
      setSyncFailed(!result.ozonSynced);
      setSaved(result.stockAvailable);
      setValue(String(result.stockAvailable));
      if (result.ozonSynced) {
        toast.success("Остаток сохранён и отправлен в Ozon");
      } else {
        toast.warning(
          "Остаток сохранён на сайте, но в Ozon не обновился — без него Ozon Доставка не примет заказ. Сохраните ещё раз или поправьте остаток на складе Лотошино_наличие в кабинете Ozon.",
        );
      }
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не сохранилось"),
  });

  const ozonMutation = useMutation({
    ...orpc.admin.products.setSellOnOzon.mutationOptions(),
    onSuccess: (result) => {
      setOnOzon(result.sellOnOzon);
      if (!result.ozonSynced) {
        toast.warning(
          "Сохранено на сайте, но Ozon не ответил — видимость на Ozon не поменялась. Переключите ещё раз или поправьте её в кабинете Ozon.",
        );
      } else if (result.sellOnOzon) {
        toast.success("Товар выставлен на витрину Ozon");
      } else {
        toast.success("Товар продаётся только на сайте");
      }
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не сохранилось"),
  });

  const parsed = value.trim() === "" ? Number.NaN : Number(value);
  const canSave =
    Number.isInteger(parsed) &&
    parsed >= 0 &&
    parsed <= 9999 &&
    (parsed !== saved || syncFailed);

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
          disabled={!canSave || mutation.isPending}
          onClick={() => mutation.mutate({ id, stockAvailable: parsed })}
        >
          Сохранить остаток
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {sku
          ? `Ozon SKU ${sku}${offerId ? ` · артикул ${offerId}` : ""}. При сохранении остаток уходит на склад Ozon${onOzon ? "" : ", а товар скрывается с витрины Ozon"}. `
          : "Нет SKU Ozon — продаётся только под заказ. "}
        Остаток уменьшается сам, когда заказ оплачен.
      </p>
      {sku !== null && offerId !== null && (
        <div className="flex items-center justify-between gap-4 border-t pt-3">
          <div>
            <Label htmlFor="sellOnOzon" className="font-medium">
              Продавать на Ozon
            </Label>
            <p className="text-muted-foreground text-xs">
              Товар виден и на витрине Ozon. Остаток общий с сайтом: после
              покупки на Ozon он уменьшается здесь сам, в течение 10 минут.
            </p>
          </div>
          <Switch
            id="sellOnOzon"
            checked={onOzon}
            disabled={ozonMutation.isPending}
            onCheckedChange={(checked) =>
              ozonMutation.mutate({ id, sellOnOzon: checked })
            }
          />
        </div>
      )}
    </div>
  );
}
