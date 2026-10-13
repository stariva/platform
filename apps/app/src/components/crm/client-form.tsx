"use client";

import type { AdChannel } from "@stariva/db/schema";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { orpc } from "~/orpc/react";
import { CHANNEL_LABELS } from "./crm-meta";

export interface CampaignOption {
  id: string;
  name: string;
  channel: AdChannel;
  archived: boolean;
}

export interface ClientFormValues {
  name: string;
  phone: string;
  email: string;
  // auto | none | id кампании
  source: string;
  notes: string;
}

/**
 * Имя, контакты, источник и заметки клиента. Без key — новый клиент, иначе
 * правка существующего (клиент с сайта получит карточку при сохранении).
 */
export function ClientForm({
  clientKey,
  initial,
  campaigns,
  hasSiteOrders,
}: {
  clientKey?: string;
  initial: ClientFormValues;
  campaigns: CampaignOption[];
  hasSiteOrders: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const set = (field: keyof ClientFormValues) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  const save = useMutation({
    ...orpc.admin.crm.saveClient.mutationOptions(),
    onSuccess: ({ key }) => {
      toast.success(clientKey ? "Сохранено" : "Клиент добавлен");
      if (key !== clientKey) {
        router.replace(`/crm/clients/${encodeURIComponent(key)}`);
      }
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не сохранилось"),
  });

  const options = campaigns.filter(
    (campaign) => !campaign.archived || campaign.id === initial.source,
  );
  const sourceLabels: Record<string, string> = {
    auto: "По UTM-метке заказов",
    none: "Не с рекламы",
    ...Object.fromEntries(
      options.map((c) => [c.id, `${c.name} · ${CHANNEL_LABELS[c.channel]}`]),
    ),
  };

  const changed = (Object.keys(values) as (keyof ClientFormValues)[]).some(
    (field) => values[field].trim() !== initial[field].trim(),
  );

  /** Отправляет поля карточки, преобразуя выбранную кампанию в объект источника. */
  function submit(event: React.FormEvent) {
    event.preventDefault();
    save.mutate({
      key: clientKey,
      name: values.name,
      phone: values.phone,
      email: values.email,
      source:
        values.source === "auto" || values.source === "none"
          ? values.source
          : { campaignId: values.source },
      notes: values.notes,
    });
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-1.5">
        <Label htmlFor="client-name">Имя</Label>
        <Input
          id="client-name"
          required
          maxLength={120}
          value={values.name}
          onChange={(event) => set("name")(event.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="client-phone">Телефон</Label>
          <Input
            id="client-phone"
            type="tel"
            maxLength={40}
            placeholder="+7 916 123-45-67"
            value={values.phone}
            onChange={(event) => set("phone")(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="client-email">Почта</Label>
          <Input
            id="client-email"
            type="email"
            maxLength={200}
            value={values.email}
            onChange={(event) => set("email")(event.target.value)}
          />
        </div>
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        По телефону и почте клиент склеивается с заказами на сайте.
      </p>

      <div className="space-y-1.5">
        <Label>Откуда пришёл</Label>
        <Select
          value={values.source}
          onValueChange={(value) => {
            if (value) set("source")(value);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(value: string) => sourceLabels[value] ?? "Кампания удалена"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {hasSiteOrders && (
              <SelectItem value="auto">{sourceLabels.auto}</SelectItem>
            )}
            <SelectItem value="none">{sourceLabels.none}</SelectItem>
            {options.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {sourceLabels[campaign.id]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          {hasSiteOrders
            ? "«По UTM-метке» — источник берётся из первого заказа с меткой. Выберите кампанию, если клиент на самом деле пришёл с другой рекламы."
            : "Нужной кампании нет в списке — заведите её в разделе «Кампании и расходы»."}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="client-notes">Заметки</Label>
        <Textarea
          id="client-notes"
          rows={4}
          maxLength={4000}
          placeholder="Что спрашивал, о чём договорились, где переписка"
          value={values.notes}
          onChange={(event) => set("notes")(event.target.value)}
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={save.isPending || (clientKey !== undefined && !changed)}
      >
        {save.isPending
          ? "Сохраняем…"
          : clientKey
            ? "Сохранить"
            : "Добавить клиента"}
      </Button>
    </form>
  );
}
