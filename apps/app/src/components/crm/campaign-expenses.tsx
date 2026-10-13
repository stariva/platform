"use client";

import {
  Button,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "~/components/confirm-dialog";
import { orpc } from "~/orpc/react";
import { formatDay, rubles, todayInMoscow } from "./crm-meta";

export interface ExpenseView {
  id: string;
  spentOn: string;
  amount: number;
  note: string | null;
}

/** Расходы кампании: пополнения кабинета, оплата посевов и блогеров. */
export function CampaignExpenses({
  campaignId,
  expenses,
}: {
  campaignId: string;
  expenses: ExpenseView[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [spentOn, setSpentOn] = useState(todayInMoscow);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const add = useMutation({
    ...orpc.admin.crm.addExpense.mutationOptions(),
    onSuccess: () => {
      toast.success("Расход добавлен");
      setAmount("");
      setNote("");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не сохранилось"),
  });

  const remove = useMutation({
    ...orpc.admin.crm.removeExpense.mutationOptions(),
    onSuccess: () => {
      toast.success("Расход удалён");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не удалилось"),
  });

  const parsedAmount = Number(amount.replace(",", ".").replace(/\s/g, ""));

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 sm:grid-cols-[150px_140px_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate({ campaignId, spentOn, amount: parsedAmount, note });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="expense-date">Дата</Label>
          <Input
            id="expense-date"
            type="date"
            required
            value={spentOn}
            onChange={(event) => setSpentOn(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expense-amount">Сумма, ₽</Label>
          <Input
            id="expense-amount"
            inputMode="decimal"
            required
            placeholder="5000"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expense-note">Комментарий</Label>
          <Input
            id="expense-note"
            maxLength={300}
            placeholder="Пополнение кабинета, посев в канале…"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={add.isPending || !(parsedAmount > 0)}>
          {add.isPending ? "Добавляем…" : "Добавить расход"}
        </Button>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Комментарий</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-muted-foreground py-6 text-center"
                >
                  Расходов пока нет
                </TableCell>
              </TableRow>
            )}
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDay(expense.spentOn)}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[360px] whitespace-normal">
                  {expense.note ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {rubles.format(expense.amount)}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Удалить расход"
                    disabled={remove.isPending}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: "Удалить расход?",
                          description: `${formatDay(expense.spentOn)} — ${rubles.format(expense.amount)}`,
                          confirmLabel: "Удалить",
                          destructive: true,
                        })
                      ) {
                        remove.mutate({ id: expense.id });
                      }
                    }}
                  >
                    ✕
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
