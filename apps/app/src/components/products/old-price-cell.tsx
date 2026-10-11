"use client";

import { Input, toast } from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { orpc } from "~/orpc/react";

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

/** Старая цена в таблице: клик — поле ввода, Enter или уход фокуса сохраняет, пустое поле убирает, Esc отменяет. */
export function OldPriceCell({
  id,
  oldPrice,
}: {
  id: string;
  oldPrice: number | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [shown, setShown] = useState(oldPrice);
  const [previousOldPrice, setPreviousOldPrice] = useState(oldPrice);
  const cancelled = useRef(false);

  if (oldPrice !== previousOldPrice) {
    setPreviousOldPrice(oldPrice);
    setShown(oldPrice);
  }

  const mutation = useMutation({
    ...orpc.admin.products.setOldPrice.mutationOptions(),
    onSuccess: (result) => {
      setShown(result.oldPrice);
      setEditing(false);
      toast.success(
        result.revalidated
          ? "Старая цена сохранена, сайт обновлён"
          : "Старая цена сохранена. На сайте обновится в течение часа",
      );
      router.refresh();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Не сохранилось");
      setEditing(false);
    },
  });

  const start = () => {
    cancelled.current = false;
    setDraft(shown === null ? "" : String(shown));
    setEditing(true);
  };

  const commit = () => {
    if (mutation.isPending || cancelled.current) return;
    const text = draft.trim();
    const value = text === "" ? null : Number(text.replace(",", "."));
    if (value !== null && !Number.isFinite(value)) {
      toast.error("Введите цену числом");
      setEditing(false);
      return;
    }
    if (value === shown) {
      setEditing(false);
      return;
    }
    mutation.mutate({ id, oldPrice: value });
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={start}
        title={shown === null ? "Указать старую цену" : "Изменить старую цену"}
        className="hover:bg-muted -mx-2 rounded px-2 py-1 tabular-nums"
      >
        {shown === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="text-muted-foreground line-through">
            {rub.format(shown)}
          </span>
        )}
      </button>
    );
  }

  return (
    <Input
      autoFocus
      type="number"
      inputMode="decimal"
      step="0.01"
      min="0"
      value={draft}
      disabled={mutation.isPending}
      placeholder="Пусто — убрать"
      aria-label="Старая цена, ₽"
      className="ml-auto h-8 w-32 text-right tabular-nums"
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
