"use client";

import { Badge, Input, toast } from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { orpc } from "~/orpc/react";

/**
 * Остаток в таблице: клик — поле ввода, Enter или уход фокуса сохраняет, Esc отменяет.
 * Как и на странице товара, новое значение сразу уходит на склад Ozon.
 * Без SKU и артикула Ozon товар продаётся только под заказ — остаток не правится.
 */
export function StockCell({
  id,
  stockAvailable,
  canStock,
}: {
  id: string;
  stockAvailable: number;
  canStock: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [shown, setShown] = useState(stockAvailable);
  const [previousStock, setPreviousStock] = useState(stockAvailable);
  const cancelled = useRef(false);

  if (stockAvailable !== previousStock) {
    setPreviousStock(stockAvailable);
    setShown(stockAvailable);
  }

  const mutation = useMutation({
    ...orpc.admin.products.setStock.mutationOptions(),
    onSuccess: (result) => {
      setShown(result.stockAvailable);
      setEditing(false);
      if (result.ozonSynced) {
        toast.success("Остаток сохранён и отправлен в Ozon");
      } else {
        toast.warning(
          "Остаток сохранён на сайте, но в Ozon не обновился — без него Ozon Доставка не примет заказ. Сохраните ещё раз или поправьте остаток на складе Лотошино_наличие в кабинете Ozon.",
        );
      }
      router.refresh();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Не сохранилось");
      setEditing(false);
    },
  });

  const start = () => {
    cancelled.current = false;
    setDraft(String(shown));
    setEditing(true);
  };

  const commit = () => {
    if (mutation.isPending || cancelled.current) return;
    const value = draft.trim() === "" ? Number.NaN : Number(draft);
    if (!Number.isInteger(value) || value < 0 || value > 9999) {
      toast.error("Введите целое число от 0 до 9999");
      setEditing(false);
      return;
    }
    if (value === shown) {
      setEditing(false);
      return;
    }
    mutation.mutate({ id, stockAvailable: value });
  };

  const label =
    shown > 0 ? (
      <Badge variant="default">В наличии: {shown}</Badge>
    ) : (
      <span className="text-muted-foreground text-xs">Нет в наличии</span>
    );

  // Без Ozon можно только обнулить остаток, если он почему-то есть.
  if (!canStock && shown === 0) {
    return (
      <span
        className="text-muted-foreground text-xs"
        title="Нет SKU или артикула Ozon — только под заказ"
      >
        Нет в наличии
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={start}
        title="Изменить остаток"
        className="hover:bg-muted -mx-1 w-fit rounded px-1 py-0.5 text-left"
      >
        {label}
      </button>
    );
  }

  return (
    <Input
      autoFocus
      type="number"
      inputMode="numeric"
      step="1"
      min="0"
      max={canStock ? 9999 : 0}
      value={draft}
      disabled={mutation.isPending}
      aria-label="Готовых изделий в наличии"
      className="h-8 w-20 tabular-nums"
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          cancelled.current = true;
          setEditing(false);
        }
      }}
    />
  );
}
