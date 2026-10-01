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

/** Цена в таблице: клик — поле ввода, Enter или уход фокуса сохраняет, Esc отменяет. */
export function PriceCell({ id, price }: { id: string; price: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [shown, setShown] = useState(price);
  const [previousPrice, setPreviousPrice] = useState(price);
  const cancelled = useRef(false);

  if (price !== previousPrice) {
    setPreviousPrice(price);
    setShown(price);
  }

  const mutation = useMutation({
    ...orpc.admin.products.setPrice.mutationOptions(),
    onSuccess: (result) => {
      setShown(result.price);
      setEditing(false);
      toast.success(
        result.revalidated
          ? "Цена сохранена, сайт обновлён"
          : "Цена сохранена. На сайте обновится в течение часа",
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
    setDraft(String(shown));
    setEditing(true);
  };

  const commit = () => {
    if (mutation.isPending || cancelled.current) return;
    const value = Number(draft.replace(",", "."));
    if (!Number.isFinite(value) || value === shown) {
      if (!Number.isFinite(value) || draft.trim() === "") {
        toast.error("Введите цену числом");
      }
      setEditing(false);
      return;
    }
    mutation.mutate({ id, price: value });
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={start}
        title="Изменить цену"
        className="hover:bg-muted -mx-2 rounded px-2 py-1 tabular-nums"
      >
        {rub.format(shown)}
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
      aria-label="Цена, ₽"
      className="ml-auto h-8 w-28 text-right tabular-nums"
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
