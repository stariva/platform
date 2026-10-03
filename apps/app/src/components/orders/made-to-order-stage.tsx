"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
  toast,
} from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { orpc } from "~/orpc/react";
import {
  type AdminOrderView,
  dateTime,
  orderPageUrl,
  rubles,
  shortId,
} from "./order-meta";

/** После предоплаты заказ уже не отклоняют, а отменяют — с возвратом денег вручную. */
const CANCELABLE = new Set([
  "in_production",
  "awaiting_balance",
  "ready_to_ship",
]);

/** Рубли из поля ввода: запятая как разделитель, пусто — ноль. */
function parseRubles(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (normalized === "") return 0;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

/** Как на сервере: половина стоимости изделий без доставки, до рубля. */
const depositFor = (amountProducts: number) => Math.round(amountProducts / 2);

const isOverdue = (order: AdminOrderView) =>
  order.paymentDueAt !== null && new Date(order.paymentDueAt) < new Date();

/** Текст для мессенджера: что согласовано, сколько и до когда оплатить. */
function paymentMessage(order: AdminOrderView): string {
  const due = order.paymentDueAt
    ? dateTime.format(new Date(order.paymentDueAt))
    : "";
  const link = `${orderPageUrl(order.id)} (на странице введите телефон из заявки)`;
  const delivery =
    order.amountDelivery > 0
      ? ` + доставка ${rubles.format(order.amountDelivery)}`
      : "";
  if (order.status === "awaiting_balance") {
    const balance = order.amountTotal - (order.depositAmount ?? 0);
    return [
      `Здравствуйте, ${order.contactName}! Ваше изделие по заказу №${shortId(order.id)} готово.`,
      `Доплата — ${rubles.format(balance)}${order.amountDelivery > 0 ? `, включая доставку ${rubles.format(order.amountDelivery)}` : ""}. Оплатить до ${due}:`,
      link,
    ].join("\n");
  }
  return [
    `Здравствуйте, ${order.contactName}! Заказ №${shortId(order.id)} согласован: ${rubles.format(order.amountProducts)}${delivery}${order.leadTime ? `, срок изготовления — ${order.leadTime}` : ""}.`,
    `Предоплата 50% — ${rubles.format(order.depositAmount ?? 0)}, оплатить до ${due}:`,
    link,
  ].join("\n");
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-right">{children}</span>
    </div>
  );
}

/**
 * Этапы заказа под заказ: условия и одобрение заявки, ожидание предоплаты,
 * выставление доплаты, отказ и отмена. Оплаты двигает платёжная система.
 */
export function MadeToOrderStage({ order }: { order: AdminOrderView }) {
  const router = useRouter();
  const handlers = {
    onSuccess: () => {
      toast.success("Готово");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не получилось"),
  };
  const terms = useMutation({
    ...orpc.admin.orders.terms.mutationOptions(),
    ...handlers,
  });
  const decline = useMutation({
    ...orpc.admin.orders.decline.mutationOptions(),
    ...handlers,
  });
  const reopen = useMutation({
    ...orpc.admin.orders.reopen.mutationOptions(),
    ...handlers,
  });
  const requestBalance = useMutation({
    ...orpc.admin.orders.requestBalance.mutationOptions(),
    ...handlers,
  });
  const extendPayment = useMutation({
    ...orpc.admin.orders.extendPayment.mutationOptions(),
    ...handlers,
  });
  const cancel = useMutation({
    ...orpc.admin.orders.cancel.mutationOptions(),
    ...handlers,
  });
  const busy = [
    terms,
    decline,
    reopen,
    requestBalance,
    extendPayment,
    cancel,
  ].some((mutation) => mutation.isPending);

  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      order.items.map((item) => [item.id, String(item.price)]),
    ),
  );
  const [delivery, setDelivery] = useState(String(order.amountDelivery));
  const [leadTime, setLeadTime] = useState(order.leadTime ?? "");
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const parsedPrices = order.items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    price: parseRubles(prices[item.id] ?? ""),
  }));
  const parsedDelivery = parseRubles(delivery);
  const termsValid =
    parsedPrices.every((item) => item.price !== null) &&
    parsedDelivery !== null;
  const amountProducts = parsedPrices.reduce(
    (sum, item) => sum + (item.price ?? 0) * item.quantity,
    0,
  );

  function saveTerms(approve: boolean) {
    if (!termsValid || parsedDelivery === null) return;
    terms.mutate({
      id: order.id,
      items: parsedPrices.map((item) => ({
        id: item.id,
        price: item.price ?? 0,
      })),
      amountDelivery: parsedDelivery,
      leadTime: leadTime.trim(),
      approve,
    });
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(paymentMessage(order));
      toast.success("Сообщение со ссылкой скопировано");
    } catch {
      toast.error("Не удалось скопировать — выделите текст вручную");
    }
  }

  const awaitingPayment =
    order.status === "awaiting_deposit" || order.status === "awaiting_balance";
  const balance = order.amountTotal - (order.depositAmount ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Этап заказа</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {order.status === "requested" && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Свяжитесь с покупателем, согласуйте цену, мерки и доставку. После
              одобрения покупателю откроется предоплата 50%.
            </p>
            {order.items.map((item) => (
              <div key={item.id} className="space-y-1.5">
                <Label htmlFor={`price-${item.id}`}>
                  {item.name} — цена за шт., ₽
                  {item.quantity > 1 && ` (× ${item.quantity})`}
                </Label>
                <Input
                  id={`price-${item.id}`}
                  inputMode="decimal"
                  value={prices[item.id] ?? ""}
                  onChange={(event) =>
                    setPrices((prev) => ({
                      ...prev,
                      [item.id]: event.target.value,
                    }))
                  }
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="delivery">Доставка, ₽</Label>
              <Input
                id="delivery"
                inputMode="decimal"
                value={delivery}
                onChange={(event) => setDelivery(event.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Можно уточнить позже — перед доплатой.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-time">Срок изготовления</Label>
              <Input
                id="lead-time"
                value={leadTime}
                maxLength={120}
                placeholder="Например, 2–3 недели"
                onChange={(event) => setLeadTime(event.target.value)}
              />
            </div>
            {termsValid && (
              <div className="space-y-1 rounded-lg border p-3">
                <Line label="Изделия">{rubles.format(amountProducts)}</Line>
                <Line label="Предоплата 50%">
                  {rubles.format(depositFor(amountProducts))}
                </Line>
                <Line label="Доплата с доставкой">
                  {rubles.format(
                    amountProducts -
                      depositFor(amountProducts) +
                      (parsedDelivery ?? 0),
                  )}
                </Line>
              </div>
            )}
            <div className="grid gap-2">
              <Button
                disabled={!termsValid || amountProducts <= 0 || busy}
                onClick={() => saveTerms(true)}
              >
                Одобрить и выставить предоплату
              </Button>
              <Button
                variant="outline"
                disabled={!termsValid || busy}
                onClick={() => saveTerms(false)}
              >
                Сохранить условия
              </Button>
            </div>
          </div>
        )}

        {awaitingPayment && (
          <div className="space-y-3">
            <div className="space-y-1 rounded-lg border p-3">
              {order.status === "awaiting_deposit" ? (
                <>
                  <Line label="Изделия">
                    {rubles.format(order.amountProducts)}
                  </Line>
                  <Line label="Предоплата 50%">
                    {rubles.format(order.depositAmount ?? 0)}
                  </Line>
                  {order.leadTime && (
                    <Line label="Срок изготовления">{order.leadTime}</Line>
                  )}
                </>
              ) : (
                <>
                  <Line label="Доплата">{rubles.format(balance)}</Line>
                  <Line label="В том числе доставка">
                    {rubles.format(order.amountDelivery)}
                  </Line>
                </>
              )}
              {order.paymentDueAt && (
                <Line label="Оплатить до">
                  {dateTime.format(new Date(order.paymentDueAt))}
                </Line>
              )}
            </div>
            {isOverdue(order) && (
              <Badge variant="destructive">
                Срок вышел — покупатель не может оплатить
              </Badge>
            )}
            <Button className="w-full" variant="outline" onClick={copyMessage}>
              Скопировать сообщение со ссылкой
            </Button>
            <Button
              className="w-full"
              variant="outline"
              disabled={busy}
              onClick={() => extendPayment.mutate({ id: order.id })}
            >
              Продлить срок оплаты на 3 дня
            </Button>
            {order.status === "awaiting_deposit" && (
              <Button
                className="w-full"
                variant="ghost"
                disabled={busy}
                onClick={() => reopen.mutate({ id: order.id })}
              >
                Вернуть на согласование
              </Button>
            )}
          </div>
        )}

        {order.status === "in_production" && (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Предоплата получена
              {order.depositPaidAt &&
                ` ${dateTime.format(new Date(order.depositPaidAt))}`}
              . Когда изделие будет готово, уточните доставку и выставите
              доплату.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="balance-delivery">Доставка, ₽</Label>
              <Input
                id="balance-delivery"
                inputMode="decimal"
                value={delivery}
                onChange={(event) => setDelivery(event.target.value)}
              />
            </div>
            {parsedDelivery !== null && (
              <div className="rounded-lg border p-3">
                <Line label="Доплата">
                  {rubles.format(
                    order.amountProducts -
                      (order.depositAmount ?? 0) +
                      parsedDelivery,
                  )}
                </Line>
              </div>
            )}
            <Button
              className="w-full"
              disabled={parsedDelivery === null || busy}
              onClick={() =>
                parsedDelivery !== null &&
                requestBalance.mutate({
                  id: order.id,
                  amountDelivery: parsedDelivery,
                })
              }
            >
              Готово — выставить доплату
            </Button>
          </div>
        )}

        {order.status === "declined" && (
          <p className="text-sm">
            Заявка отклонена
            {order.declineReason && `: ${order.declineReason}`}
          </p>
        )}

        {(order.status === "requested" ||
          order.status === "awaiting_deposit") &&
          (declining ? (
            <div className="space-y-2">
              <Label htmlFor="decline-reason">Причина отказа</Label>
              <Textarea
                id="decline-reason"
                rows={3}
                maxLength={1000}
                value={declineReason}
                placeholder="Покупатель увидит её на странице заказа"
                onChange={(event) => setDeclineReason(event.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={!declineReason.trim() || busy}
                  onClick={() =>
                    decline.mutate({
                      id: order.id,
                      reason: declineReason.trim(),
                    })
                  }
                >
                  Отклонить заявку
                </Button>
                <Button variant="ghost" onClick={() => setDeclining(false)}>
                  Не отклонять
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="w-full"
              variant="ghost"
              onClick={() => setDeclining(true)}
            >
              Отклонить заявку…
            </Button>
          ))}

        {order.payments.length > 0 && (
          <div className="space-y-1 border-t pt-3">
            <p className="text-muted-foreground text-xs">Оплаты</p>
            {order.payments.map((payment) => (
              <Line
                key={payment.id}
                label={payment.type === "deposit" ? "Предоплата" : "Доплата"}
              >
                {rubles.format(payment.amount)}
                {payment.paidAt &&
                  ` · ${dateTime.format(new Date(payment.paidAt))}`}
              </Line>
            ))}
          </div>
        )}

        {CANCELABLE.has(order.status) && (
          <Button
            className="w-full"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "Отменить заказ? Полученные деньги нужно будет вернуть вручную в кабинете ЮKassa.",
                )
              ) {
                cancel.mutate({ id: order.id });
              }
            }}
          >
            Отменить заказ
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
