"use client";

import { Button, Input, toast } from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { orpc } from "~/orpc/react";

type Mode = "fixed" | "markup" | "clear";

const MODES: { id: Mode; label: string }[] = [
  { id: "fixed", label: "Задать цену" },
  { id: "markup", label: "Наценка к цене" },
  { id: "clear", label: "Убрать" },
];

/** Панель массовой правки старой цены у выбранных в таблице товаров. */
export function BulkOldPrice({
  ids,
  onDone,
}: {
  ids: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("fixed");
  const [draft, setDraft] = useState("");

  const mutation = useMutation({
    ...orpc.admin.products.setOldPriceBulk.mutationOptions(),
    onSuccess: (result) => {
      const skipped =
        result.skipped > 0
          ? `, пропущено ${result.skipped} (цена не ниже старой или без изменений)`
          : "";
      toast.success(
        `Обновлено товаров: ${result.updated}${skipped}${
          result.revalidated ? "" : ". На сайте обновится в течение часа"
        }`,
      );
      setDraft("");
      onDone();
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не сохранилось"),
  });

  const apply = () => {
    if (mode === "clear") {
      mutation.mutate({ ids, change: { type: "clear" } });
      return;
    }
    const value = Number(draft.replace(",", "."));
    if (draft.trim() === "" || !Number.isFinite(value) || value < 0) {
      toast.error(
        mode === "fixed"
          ? "Введите старую цену числом (0 — убрать)"
          : "Введите процент числом больше нуля",
      );
      return;
    }
    if (value === 0) {
      // 0 в «Задать цену» — то же, что «Убрать»; нулевая наценка смысла не имеет.
      if (mode === "markup") {
        toast.error("Введите процент числом больше нуля");
        return;
      }
      mutation.mutate({ ids, change: { type: "clear" } });
      return;
    }
    mutation.mutate({
      ids,
      change:
        mode === "fixed"
          ? { type: "fixed", oldPrice: value }
          : { type: "markup", percent: value },
    });
  };

  return (
    <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
      <span className="text-sm font-medium tabular-nums">
        Выбрано: {ids.length}
      </span>
      <span className="text-muted-foreground text-sm">Старая цена:</span>
      {MODES.map(({ id, label }) => (
        <Button
          key={id}
          size="sm"
          variant={mode === id ? "default" : "outline"}
          aria-pressed={mode === id}
          onClick={() => setMode(id)}
        >
          {label}
        </Button>
      ))}
      {mode !== "clear" && (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            inputMode="decimal"
            step={mode === "fixed" ? "0.01" : "1"}
            min="0"
            value={draft}
            disabled={mutation.isPending}
            placeholder={mode === "fixed" ? "Например, 5000" : "Например, 30"}
            aria-label={
              mode === "fixed" ? "Старая цена, ₽" : "Наценка к цене, %"
            }
            className="h-8 w-36 text-right tabular-nums"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") apply();
            }}
          />
          <span className="text-muted-foreground text-sm">
            {mode === "fixed" ? "₽" : "%"}
          </span>
        </div>
      )}
      <Button size="sm" disabled={mutation.isPending} onClick={apply}>
        {mode === "clear" ? "Убрать у выбранных" : "Применить"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone}>
        Снять выбор
      </Button>
      {mode === "markup" && (
        <span className="text-muted-foreground w-full text-xs">
          Старая цена = текущая цена + процент, округлённая до целых рублей
        </span>
      )}
    </div>
  );
}
