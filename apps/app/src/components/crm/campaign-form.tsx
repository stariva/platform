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
  Switch,
  Textarea,
  toast,
} from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { orpc } from "~/orpc/react";
import { CHANNEL_LABELS, CHANNELS } from "./crm-meta";

export interface CampaignFormValues {
  name: string;
  channel: AdChannel;
  utmSource: string;
  utmCampaign: string;
  directCampaignId: string;
  notes: string;
  archived: boolean;
}

/** Новая кампания (без id) или правка существующей. */
export function CampaignForm({
  id,
  initial,
}: {
  id?: string;
  initial: CampaignFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const set = <K extends keyof CampaignFormValues>(
    field: K,
    value: CampaignFormValues[K],
  ) => setValues((current) => ({ ...current, [field]: value }));

  const save = useMutation({
    ...orpc.admin.crm.saveCampaign.mutationOptions(),
    onSuccess: (result) => {
      toast.success(id ? "Сохранено" : "Кампания заведена");
      if (!id) router.push(`/crm/campaigns/${result.id}`);
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не сохранилось"),
  });

  const changed = (Object.keys(values) as (keyof CampaignFormValues)[]).some(
    (field) => values[field] !== initial[field],
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({
          id,
          ...values,
          // Привязка к Директу — только у кампаний Директа
          directCampaignId:
            values.channel === "yandex_direct" ? values.directCampaignId : "",
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <div className="space-y-1.5">
          <Label htmlFor="campaign-name">Название</Label>
          <Input
            id="campaign-name"
            required
            maxLength={120}
            placeholder="Директ — абажуры"
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="campaign-channel">Канал</Label>
          <Select
            value={values.channel}
            onValueChange={(value) => {
              if (value) set("channel", value as AdChannel);
            }}
          >
            <SelectTrigger id="campaign-channel" className="w-full">
              <SelectValue>
                {(value: AdChannel) => CHANNEL_LABELS[value]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((channel) => (
                <SelectItem key={channel} value={channel}>
                  {CHANNEL_LABELS[channel]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="campaign-utm-source">utm_source</Label>
          <Input
            id="campaign-utm-source"
            maxLength={120}
            placeholder="yandex"
            value={values.utmSource}
            onChange={(event) => set("utmSource", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="campaign-utm-campaign">utm_campaign</Label>
          <Input
            id="campaign-utm-campaign"
            maxLength={120}
            placeholder="все кампании источника"
            value={values.utmCampaign}
            onChange={(event) => set("utmCampaign", event.target.value)}
          />
        </div>
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Заказы с сайта попадут в кампанию по меткам из ссылки в объявлении.
        Пустой utm_campaign — все кампании этого источника, кроме заведённых
        отдельно. Без меток (Авито, сарафан) клиентов отмечают вручную в их
        карточке.
      </p>

      {values.channel === "yandex_direct" && (
        <div className="space-y-1.5">
          <Label htmlFor="campaign-direct-id">ID кампании в Директе</Label>
          <Input
            id="campaign-direct-id"
            inputMode="numeric"
            maxLength={15}
            placeholder="715338803"
            value={values.directCampaignId}
            onChange={(event) =>
              set("directCampaignId", event.target.value.replace(/\D/g, ""))
            }
          />
          <p className="text-muted-foreground text-xs">
            Расход за каждый день с НДС подтянется из Директа сам, каждое утро
            за вчера. Дни, за которые расход уже внесён вручную, не трогаются.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="campaign-notes">Заметки</Label>
        <Textarea
          id="campaign-notes"
          rows={3}
          maxLength={2000}
          placeholder="Аудитория, объявления, ссылка на кабинет"
          value={values.notes}
          onChange={(event) => set("notes", event.target.value)}
        />
      </div>

      {id && (
        <div className="flex items-center gap-2">
          <Switch
            id="campaign-archived"
            checked={values.archived}
            onCheckedChange={(archived) => set("archived", archived)}
          />
          <Label htmlFor="campaign-archived">
            Закончилась — убрать из выбора для новых клиентов
          </Label>
        </div>
      )}

      <Button
        type="submit"
        disabled={save.isPending || (id !== undefined && !changed)}
      >
        {save.isPending ? "Сохраняем…" : id ? "Сохранить" : "Завести кампанию"}
      </Button>
    </form>
  );
}
