"use client";

import type { CrmOrderStatus } from "@stariva/db/schema";
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
import type { CampaignOption } from "./client-form";
import { formatDay, rubles, todayInMoscow } from "./crm-meta";
import {
  OrderFields,
  type OrderFieldsValue,
  orderInput,
  useOrderFields,
} from "./order-fields";
import { CRM_STATUS_LABELS, parseRubles } from "./work-meta";

/** Путь заказа по этапам; отмена — отдельной кнопкой. */
const FLOW: CrmOrderStatus[] = [
  "new",
  "awaiting_payment",
  "in_production",
  "ready",
  "shipped",
  "done",
];

const onError = (error: Error) =>
  toast.error(error.message || "Не сохранилось");

/** Этапы кнопками: текущий выделен, следующий — подсказкой. */
export function OrderStageControl({
  id,
  status,
}: {
  id: string;
  status: CrmOrderStatus;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const set = useMutation({
    ...orpc.admin.crm.setOrderStatus.mutationOptions(),
    onSuccess: ({ status: next }) => {
      toast.success(`Этап: ${CRM_STATUS_LABELS[next]}`);
      router.refresh();
    },
    onError,
  });
  const current = FLOW.indexOf(status);
  const next = current >= 0 ? FLOW[current + 1] : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FLOW.map((step, index) => (
          <Button
            key={step}
            size="sm"
            variant={
              step === status
                ? "default"
                : current >= 0 && index < current
                  ? "secondary"
                  : "outline"
            }
            disabled={set.isPending}
            aria-current={step === status ? "step" : undefined}
            onClick={() => {
              if (step !== status) set.mutate({ id, status: step });
            }}
          >
            {index + 1}. {CRM_STATUS_LABELS[step]}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {next && (
          <Button
            disabled={set.isPending}
            onClick={() => set.mutate({ id, status: next })}
          >
            Дальше: {CRM_STATUS_LABELS[next]}
          </Button>
        )}
        {status === "canceled" ? (
          <Button
            variant="outline"
            disabled={set.isPending}
            onClick={() => set.mutate({ id, status: "new" })}
          >
            Вернуть в работу
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="text-destructive"
            disabled={set.isPending}
            onClick={async () => {
              if (
                await confirm({
                  title: "Отменить заказ?",
                  description:
                    "Оплаты по отменённому заказу не идут в выручку — деньги считаются возвращёнными.",
                  confirmLabel: "Отменить заказ",
                  destructive: true,
                })
              ) {
                set.mutate({ id, status: "canceled" });
              }
            }}
          >
            Отменить заказ
          </Button>
        )}
      </div>
    </div>
  );
}

/** Правка заказа: площадка, состав, сумма, сроки, реклама, заметки. */
export function OrderEditForm({
  id,
  initial,
  campaigns,
}: {
  id: string;
  initial: OrderFieldsValue;
  campaigns: CampaignOption[];
}) {
  const router = useRouter();
  const [fields, setFields] = useOrderFields(initial);
  const save = useMutation({
    ...orpc.admin.crm.updateOrder.mutationOptions(),
    onSuccess: () => {
      toast.success("Сохранено");
      router.refresh();
    },
    onError,
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ id, ...orderInput(fields) });
      }}
    >
      <OrderFields
        value={fields}
        onChange={setFields}
        campaigns={campaigns}
        clientKnown
      />
      <Button
        type="submit"
        disabled={save.isPending || !fields.description.trim()}
      >
        {save.isPending ? "Сохраняем…" : "Сохранить"}
      </Button>
    </form>
  );
}

/** Поступившие деньги по заказу и форма новой оплаты. */
export function OrderPayments({
  saleId,
  payments,
  toCollect,
}: {
  saleId: string;
  payments: {
    id: string;
    paidOn: string;
    amount: number;
    note: string | null;
  }[];
  toCollect: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [paidOn, setPaidOn] = useState(todayInMoscow);
  const [amount, setAmount] = useState(toCollect > 0 ? String(toCollect) : "");
  const [note, setNote] = useState("");

  const add = useMutation({
    ...orpc.admin.crm.addPayment.mutationOptions(),
    onSuccess: () => {
      toast.success("Оплата записана");
      setAmount("");
      setNote("");
      router.refresh();
    },
    onError,
  });
  const remove = useMutation({
    ...orpc.admin.crm.removePayment.mutationOptions(),
    onSuccess: () => {
      toast.success("Оплата удалена");
      router.refresh();
    },
    onError,
  });
  const parsed = parseRubles(amount);

  return (
    <div className="space-y-4">
      {payments.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Когда</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="text-sm whitespace-normal">
                    {formatDay(payment.paidOn)}
                    {payment.note && (
                      <div className="text-muted-foreground text-xs">
                        {payment.note}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {rubles.format(payment.amount)}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Удалить оплату"
                      disabled={remove.isPending}
                      onClick={async () => {
                        if (
                          await confirm({
                            title: "Удалить оплату?",
                            description: `${formatDay(payment.paidOn)} — ${rubles.format(payment.amount)}`,
                            confirmLabel: "Удалить",
                            destructive: true,
                          })
                        ) {
                          remove.mutate({ id: payment.id });
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
      )}

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate({ saleId, paidOn, amount: parsed, note });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="payment-date">Дата</Label>
            <Input
              id="payment-date"
              type="date"
              required
              max={todayInMoscow()}
              value={paidOn}
              onChange={(event) => setPaidOn(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment-amount">Сумма, ₽</Label>
            <Input
              id="payment-amount"
              inputMode="decimal"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
        </div>
        <Input
          aria-label="Комментарий к оплате"
          placeholder="Предоплата, доплата, перевод на карту…"
          maxLength={300}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <Button
          type="submit"
          variant="outline"
          disabled={add.isPending || !(parsed > 0)}
        >
          {add.isPending ? "Записываем…" : "Записать оплату"}
        </Button>
      </form>
    </div>
  );
}

/** Удаляет заказ вместе с оплатами — для дублей и ошибок. */
export function RemoveOrder({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const remove = useMutation({
    ...orpc.admin.crm.removeSale.mutationOptions(),
    onSuccess: () => {
      toast.success("Заказ удалён");
      router.push("/crm/orders");
      router.refresh();
    },
    onError,
  });
  return (
    <Button
      variant="outline"
      className="text-destructive"
      disabled={remove.isPending}
      onClick={async () => {
        if (
          await confirm({
            title: "Удалить заказ?",
            description: `${label} — вместе со всеми оплатами. Если заказ просто не состоялся, лучше отменить его: он останется в истории.`,
            confirmLabel: "Удалить",
            destructive: true,
          })
        ) {
          remove.mutate({ id });
        }
      }}
    >
      Удалить заказ
    </Button>
  );
}
