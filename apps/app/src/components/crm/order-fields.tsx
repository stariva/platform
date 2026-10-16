"use client";

import type { OrderChannel } from "@stariva/db/schema";
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@stariva/ui";
import { useState } from "react";
import type { CampaignOption } from "./client-form";
import { CHANNEL_LABELS as AD_CHANNEL_LABELS, todayInMoscow } from "./crm-meta";
import { CHANNEL_LABELS, ORDER_CHANNELS, parseRubles } from "./work-meta";

/** Реклама не выбрана: выручка идёт источнику клиента. */
const CLIENT_SOURCE = "client";

export interface OrderFieldsValue {
  channel: OrderChannel;
  externalNumber: string;
  description: string;
  amount: string;
  soldOn: string;
  dueOn: string;
  fee: string;
  campaignId: string | null;
  trackingNumber: string;
  notes: string;
}

export const emptyOrderFields = (
  draft?: Partial<OrderFieldsValue>,
): OrderFieldsValue => ({
  channel: "other",
  externalNumber: "",
  description: "",
  amount: "",
  soldOn: todayInMoscow(),
  dueOn: "",
  fee: "",
  campaignId: null,
  trackingNumber: "",
  notes: "",
  ...draft,
});

/** Поля формы → вход `addSale` / `updateOrder`. */
export const orderInput = (value: OrderFieldsValue) => {
  const amount = parseRubles(value.amount);
  const fee = parseRubles(value.fee);
  if (amount === null || fee === null) return null;
  return {
    channel: value.channel,
    externalNumber: value.externalNumber,
    description: value.description,
    amount,
    soldOn: value.soldOn,
    dueOn: value.dueOn || null,
    fee,
    campaignId: value.campaignId,
    trackingNumber: value.trackingNumber,
    notes: value.notes,
  };
};

export function useOrderFields(draft?: Partial<OrderFieldsValue>) {
  return useState(() => emptyOrderFields(draft));
}

/** Где оформлен, что, сколько, когда и с какой рекламы пришёл клиент. */
export function OrderFields({
  value,
  onChange,
  campaigns,
  clientKnown,
}: {
  value: OrderFieldsValue;
  onChange: (value: OrderFieldsValue) => void;
  campaigns: CampaignOption[];
  // Заказ пишется к известному клиенту: «как у клиента» вместо «не знаю»
  clientKnown: boolean;
}) {
  const set = <K extends keyof OrderFieldsValue>(
    key: K,
    next: OrderFieldsValue[K],
  ) => onChange({ ...value, [key]: next });

  const campaign = value.campaignId ?? CLIENT_SOURCE;
  const options = campaigns.filter((c) => !c.archived || c.id === campaign);
  const campaignLabels: Record<string, string> = {
    [CLIENT_SOURCE]: clientKnown ? "Как у клиента" : "Не знаю / не с рекламы",
    ...Object.fromEntries(
      options.map((c) => [c.id, `${c.name} · ${AD_CHANNEL_LABELS[c.channel]}`]),
    ),
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="order-channel">Где оформлен</Label>
          <Select
            value={value.channel}
            onValueChange={(next) => {
              if (next) set("channel", next as OrderChannel);
            }}
          >
            <SelectTrigger id="order-channel" className="w-full">
              <SelectValue>
                {(next: OrderChannel) => CHANNEL_LABELS[next]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ORDER_CHANNELS.map((channel) => (
                <SelectItem key={channel} value={channel}>
                  {CHANNEL_LABELS[channel]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="order-external">Номер на площадке</Label>
          <Input
            id="order-external"
            maxLength={100}
            placeholder="Номер заказа или отправления"
            value={value.externalNumber}
            onChange={(event) => set("externalNumber", event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="order-description">Что заказал</Label>
        <Input
          id="order-description"
          required
          maxLength={300}
          placeholder="Панно 120×80 по своим размерам"
          value={value.description}
          onChange={(event) => set("description", event.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="order-amount">Сумма заказа, ₽</Label>
          <Input
            id="order-amount"
            inputMode="decimal"
            placeholder="12000"
            value={value.amount}
            onChange={(event) => set("amount", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="order-date">Дата заказа</Label>
          <Input
            id="order-date"
            type="date"
            required
            max={todayInMoscow()}
            value={value.soldOn}
            onChange={(event) => set("soldOn", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="order-due">Срок</Label>
          <Input
            id="order-due"
            type="date"
            value={value.dueOn}
            onChange={(event) => set("dueOn", event.target.value)}
          />
        </div>
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Сумма 0 — цена ещё не согласована. Срок — к какому дню обещали сделать
        или отправить: после него заказ подсветится как просроченный.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="order-fee">Комиссия и расходы площадки, ₽</Label>
          <Input
            id="order-fee"
            inputMode="decimal"
            placeholder="0"
            value={value.fee}
            onChange={(event) => set("fee", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="order-tracking">Трек-номер</Label>
          <Input
            id="order-tracking"
            maxLength={200}
            placeholder="СДЭК 1234567890"
            value={value.trackingNumber}
            onChange={(event) => set("trackingNumber", event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="order-campaign">С какой рекламы</Label>
        <Select
          value={campaign}
          onValueChange={(next) => {
            if (next) set("campaignId", next === CLIENT_SOURCE ? null : next);
          }}
        >
          <SelectTrigger id="order-campaign" className="w-full">
            <SelectValue>
              {(next: string) => campaignLabels[next] ?? "Кампания удалена"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CLIENT_SOURCE}>
              {campaignLabels[CLIENT_SOURCE]}
            </SelectItem>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {campaignLabels[option.id]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Выручка заказа пойдёт этой рекламе в «Сводке». Нужной нет — заведите
          её в «Кампаниях и расходах».
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="order-notes">Заметки</Label>
        <Textarea
          id="order-notes"
          maxLength={4000}
          rows={3}
          placeholder="Мерки, цвет, адрес доставки, договорённости"
          value={value.notes}
          onChange={(event) => set("notes", event.target.value)}
        />
      </div>
    </div>
  );
}
