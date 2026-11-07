"use client";

import type { BusinessExpenseCategory } from "@stariva/db/schema";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableFooter,
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
import {
  EXPENSE_CATEGORIES,
  EXPENSE_LABELS,
  formatDay,
  rubles,
  todayInMoscow,
} from "./crm-meta";
import { parseRubles } from "./work-meta";

const onError = (error: Error) =>
  toast.error(error.message || "Не сохранилось");

/** Постоянные расходы за период и форма нового расхода. */
export function BusinessExpenses({
  expenses,
  total,
}: {
  expenses: {
    id: string;
    category: BusinessExpenseCategory;
    spentOn: string;
    amount: number;
    note: string | null;
  }[];
  total: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [category, setCategory] = useState<BusinessExpenseCategory>("services");
  const [spentOn, setSpentOn] = useState(todayInMoscow);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const add = useMutation({
    ...orpc.admin.crm.addBusinessExpense.mutationOptions(),
    onSuccess: () => {
      toast.success("Расход добавлен");
      setAmount("");
      setNote("");
      router.refresh();
    },
    onError,
  });
  const remove = useMutation({
    ...orpc.admin.crm.removeBusinessExpense.mutationOptions(),
    onSuccess: () => {
      toast.success("Расход удалён");
      router.refresh();
    },
    onError,
  });
  const parsed = parseRubles(amount);

  return (
    <div className="flex flex-col gap-4">
      <form
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_120px] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (parsed === null || parsed <= 0) {
            toast.error("Укажите сумму больше нуля");
            return;
          }
          add.mutate({ category, spentOn, amount: parsed, note });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-category">Статья</Label>
          <Select
            value={category}
            onValueChange={(next) => {
              if (next) setCategory(next as BusinessExpenseCategory);
            }}
          >
            <SelectTrigger id="expense-category" className="w-full">
              <SelectValue>
                {(value: BusinessExpenseCategory) => EXPENSE_LABELS[value]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {EXPENSE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-date">Дата</Label>
          <Input
            id="expense-date"
            type="date"
            required
            value={spentOn}
            onChange={(event) => setSpentOn(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-amount">Сумма, ₽</Label>
          <Input
            id="expense-amount"
            inputMode="decimal"
            required
            placeholder="1500"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <Input
          aria-label="Комментарий к расходу"
          className="sm:col-span-2"
          maxLength={300}
          placeholder="Сервер за ноябрь, штатив для съёмки…"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <Button
          type="submit"
          disabled={add.isPending || parsed === null || parsed <= 0}
        >
          {add.isPending ? "Добавляем…" : "Добавить"}
        </Button>
      </form>

      <div className="rounded-lg border contain-inline-size">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Статья</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-muted-foreground py-8 text-center"
                >
                  За этот период расходов нет. Добавьте первый в форме выше.
                </TableCell>
              </TableRow>
            )}
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDay(expense.spentOn)}
                </TableCell>
                <TableCell className="whitespace-normal">
                  {EXPENSE_LABELS[expense.category]}
                  {expense.note && (
                    <div className="text-muted-foreground text-xs">
                      {expense.note}
                    </div>
                  )}
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
          {expenses.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Итого</TableCell>
                <TableCell className="text-right tabular-nums">
                  {rubles.format(total)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}

/** Запятая и точка равноправны; вне 0–100% — null. */
function parsePercent(value: string): number | null {
  const parsed = Number(value.trim().replace(",", "."));
  return value.trim() && parsed >= 0 && parsed <= 100 ? parsed : null;
}

/** Ставки эквайринга и налога. */
export function FinanceRatesForm({
  rates,
}: {
  rates: { acquiring: number; tax: number };
}) {
  const router = useRouter();
  const [acquiring, setAcquiring] = useState(String(rates.acquiring));
  const [tax, setTax] = useState(String(rates.tax));
  const save = useMutation({
    ...orpc.admin.crm.saveFinanceSettings.mutationOptions(),
    onSuccess: () => {
      toast.success("Ставки сохранены");
      router.refresh();
    },
    onError,
  });
  const nextAcquiring = parsePercent(acquiring);
  const nextTax = parsePercent(tax);
  const valid = nextAcquiring !== null && nextTax !== null;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) save.mutate({ acquiring: nextAcquiring, tax: nextTax });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rate-acquiring">Эквайринг ЮKassa, %</Label>
        <Input
          id="rate-acquiring"
          inputMode="decimal"
          value={acquiring}
          onChange={(event) => setAcquiring(event.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          С оплат на сайте. Проверьте по договору с ЮKassa.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rate-tax">Налог НПД, %</Label>
        <Input
          id="rate-tax"
          inputMode="decimal"
          value={tax}
          onChange={(event) => setTax(event.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          4% с физлиц. Для заказа от юрлица запишите в нём строку «Налог» на 6%.
        </p>
      </div>
      <Button
        type="submit"
        variant="outline"
        disabled={!valid || save.isPending}
      >
        {save.isPending ? "Сохраняем…" : "Сохранить ставки"}
      </Button>
    </form>
  );
}
