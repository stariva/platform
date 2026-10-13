"use client";

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { orpc } from "~/orpc/react";
import type { CampaignOption } from "./client-form";
import { CHANNEL_LABELS, todayInMoscow } from "./crm-meta";

/** Реклама не выбрана: выручка идёт источнику клиента. */
const CLIENT_SOURCE = "client";

export interface CustomOrderDraft {
  name: string;
  phone: string;
  email: string;
  description: string;
  campaignId: string | null;
}

/**
 * Индивидуальный заказ или продажа мимо сайта с выбором рекламы, с которой
 * пришёл клиент. С clientKey пишется к этому клиенту; без него — по имени и
 * контактам: известный клиент найдётся по телефону или почте, иначе заведётся.
 */
export function CustomOrderForm({
  clientKey,
  campaigns,
  draft,
  requestNumber,
  submitLabel = "Записать заказ",
}: {
  clientKey?: string;
  campaigns: CampaignOption[];
  draft?: Partial<CustomOrderDraft>;
  requestNumber?: number;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(draft?.name ?? "");
  const [phone, setPhone] = useState(draft?.phone ?? "");
  const [email, setEmail] = useState(draft?.email ?? "");
  const [campaign, setCampaign] = useState(draft?.campaignId ?? CLIENT_SOURCE);
  const [soldOn, setSoldOn] = useState(todayInMoscow);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState(draft?.description ?? "");

  const add = useMutation({
    ...orpc.admin.crm.addSale.mutationOptions(),
    onSuccess: ({ key }) => {
      toast.success("Заказ записан");
      if (key !== clientKey) {
        router.push(`/crm/clients/${encodeURIComponent(key)}`);
      } else {
        setAmount("");
        setDescription("");
      }
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не сохранилось"),
  });

  const options = campaigns.filter((c) => !c.archived || c.id === campaign);
  const labels: Record<string, string> = {
    [CLIENT_SOURCE]: clientKey ? "Как у клиента" : "Не знаю / не с рекламы",
    ...Object.fromEntries(
      options.map((c) => [c.id, `${c.name} · ${CHANNEL_LABELS[c.channel]}`]),
    ),
  };
  const parsedAmount = Number(amount.replace(",", ".").replace(/\s/g, ""));

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        add.mutate({
          key: clientKey,
          client: clientKey ? undefined : { name, phone, email },
          soldOn,
          amount: parsedAmount,
          description,
          campaignId: campaign === CLIENT_SOURCE ? null : campaign,
          requestNumber,
        });
      }}
    >
      {!clientKey && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="order-name">Клиент</Label>
            <Input
              id="order-name"
              required
              maxLength={120}
              placeholder="Имя"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="order-phone">Телефон</Label>
              <Input
                id="order-phone"
                type="tel"
                maxLength={40}
                placeholder="+7 916 123-45-67"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order-email">Почта</Label>
              <Input
                id="order-email"
                type="email"
                maxLength={200}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </div>
          <p className="text-muted-foreground -mt-2 text-xs">
            Если клиент уже заказывал с этим телефоном или почтой, заказ
            запишется к нему.
          </p>
        </>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="order-campaign">С какой рекламы</Label>
        <Select
          value={campaign}
          onValueChange={(value) => {
            if (value) setCampaign(value);
          }}
        >
          <SelectTrigger id="order-campaign" className="w-full">
            <SelectValue>
              {(value: string) => labels[value] ?? "Кампания удалена"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CLIENT_SOURCE}>
              {labels[CLIENT_SOURCE]}
            </SelectItem>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {labels[option.id]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Выручка заказа пойдёт этой рекламе. Нужной нет — заведите её в
          «Кампаниях и расходах».
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[160px_160px]">
        <div className="space-y-1.5">
          <Label htmlFor="order-date">Дата оплаты</Label>
          <Input
            id="order-date"
            type="date"
            required
            max={todayInMoscow()}
            value={soldOn}
            onChange={(event) => setSoldOn(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="order-amount">Сумма, ₽</Label>
          <Input
            id="order-amount"
            inputMode="decimal"
            required
            placeholder="12000"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
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
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <Button
        type="submit"
        disabled={
          add.isPending ||
          !(parsedAmount > 0) ||
          !description.trim() ||
          (!clientKey && !name.trim())
        }
      >
        {add.isPending ? "Записываем…" : submitLabel}
      </Button>
    </form>
  );
}
