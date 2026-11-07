"use client";

import type { OrderCostCategory } from "@stariva/db/schema";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@stariva/ui";
import { Alert, AlertDescription } from "@stariva/ui/reui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "~/components/confirm-dialog";
import { orpc } from "~/orpc/react";
import type { api } from "~/orpc/server";
import {
  COST_LABELS,
  formatDay,
  ORDER_COST_CATEGORIES,
  profitTone,
  rubles,
  sharePercent,
  todayInMoscow,
} from "./crm-meta";
import { parseRubles } from "./work-meta";

type Economics = Awaited<ReturnType<typeof api.admin.crm.orderCosts>>;
type AutoRow = Economics["auto"][number];

const percent = (value: number) =>
  `${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`;

/** Откуда взялась посчитанная сумма. */
function autoHint(row: AutoRow, rates: Economics["rates"]) {
  switch (row.category) {
    case "acquiring":
      return `ЮKassa, ${percent(rates.acquiring)} от оплат`;
    case "tax":
      return `НПД, ${percent(rates.tax)} от оплат`;
    case "shipping":
      return "Сколько заплатил покупатель";
    case "fee":
      return "Из поля заказа";
    default:
      return "";
  }
}

const onError = (error: Error) =>
  toast.error(error.message || "Не сохранилось");

/**
 * Затраты и прибыль заказа. Материалы и прочее мастер вносит сама, эквайринг,
 * налог и доставка считаются из оплат; строка той же категории их заменяет.
 */
export function OrderCosts({
  kind,
  orderId,
  economics,
}: {
  kind: "product" | "manual";
  orderId: string;
  economics: Economics;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [category, setCategory] = useState<OrderCostCategory>("materials");
  const [spentOn, setSpentOn] = useState(todayInMoscow);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const add = useMutation({
    ...orpc.admin.crm.addOrderCost.mutationOptions(),
    onSuccess: () => {
      toast.success("Затрата записана");
      setAmount("");
      setNote("");
      router.refresh();
    },
    onError,
  });
  const remove = useMutation({
    ...orpc.admin.crm.removeOrderCost.mutationOptions(),
    onSuccess: () => {
      toast.success("Затрата удалена");
      router.refresh();
    },
    onError,
  });

  const parsed = amount.trim() ? parseRubles(amount) : null;
  const { lines, auto, rates } = economics;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Затраты и прибыль</CardTitle>
        <CardDescription>
          {economics.expected
            ? "Прибыль посчитана так, будто клиент уже доплатил остаток."
            : "Работа мастера не входит: только потраченные деньги."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile
            label={economics.expected ? "Сумма заказа" : "Поступило"}
            value={rubles.format(economics.revenue)}
          />
          <Tile label="Затраты" value={rubles.format(economics.costs)} />
          <Tile
            label={economics.expected ? "Останется" : "Прибыль"}
            value={rubles.format(economics.profit)}
            tone={profitTone(economics.profit)}
          />
          <Tile
            label="Маржа"
            value={sharePercent(economics.profit, economics.revenue)}
          />
        </dl>

        {economics.missingMaterials && (
          <Alert variant="warning">
            <AlertDescription>
              Материалы не внесены, поэтому прибыль завышена. Укажите сумму или
              0, если материалы по этому заказу не тратились.
            </AlertDescription>
          </Alert>
        )}

        {(lines.length > 0 || auto.length > 0) && (
          <div className="rounded-lg border contain-inline-size">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>На что</TableHead>
                  <TableHead>Когда</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="whitespace-normal">
                      {COST_LABELS[line.category]}
                      {line.note && (
                        <div className="text-muted-foreground text-xs">
                          {line.note}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDay(line.spentOn)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rubles.format(line.amount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Удалить затрату"
                        disabled={remove.isPending}
                        onClick={async () => {
                          if (
                            await confirm({
                              title: "Удалить затрату?",
                              description: `${COST_LABELS[line.category]} — ${rubles.format(line.amount)}`,
                              confirmLabel: "Удалить",
                              destructive: true,
                            })
                          ) {
                            remove.mutate({ id: line.id });
                          }
                        }}
                      >
                        ✕
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {auto.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell className="whitespace-normal">
                      {COST_LABELS[row.category]}
                      <div className="text-muted-foreground text-xs">
                        {autoHint(row, rates)}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      считается само
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rubles.format(row.amount)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (parsed === null) {
              toast.error("Проверьте сумму");
              return;
            }
            add.mutate({
              kind,
              orderId,
              category,
              spentOn,
              amount: parsed,
              note,
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cost-category">На что</Label>
              <Select
                value={category}
                onValueChange={(next) => {
                  if (next) setCategory(next as OrderCostCategory);
                }}
              >
                <SelectTrigger id="cost-category" className="w-full">
                  <SelectValue>
                    {(value: OrderCostCategory) => COST_LABELS[value]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ORDER_COST_CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {COST_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cost-date">Дата</Label>
              <Input
                id="cost-date"
                type="date"
                required
                value={spentOn}
                onChange={(event) => setSpentOn(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cost-amount">Сумма, ₽</Label>
              <Input
                id="cost-amount"
                inputMode="decimal"
                required
                placeholder="1500"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
          </div>
          <Input
            aria-label="Комментарий к затрате"
            placeholder="Шнур 3 мм, 200 м; часть бобины…"
            maxLength={300}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              variant="outline"
              disabled={add.isPending || parsed === null}
            >
              {add.isPending ? "Записываем…" : "Записать затрату"}
            </Button>
            <p className="text-muted-foreground text-xs">
              Строка «Доставка», «Эквайринг» или «Налог» заменит посчитанную
              сумму.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="bg-muted/40 rounded-md p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={`text-lg font-semibold tabular-nums ${tone ?? ""}`}>
        {value}
      </dd>
    </div>
  );
}
