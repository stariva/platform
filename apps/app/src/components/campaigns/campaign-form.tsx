"use client";

import type { EmailCampaignSegment } from "@stariva/db/schema";
import { Button, Checkbox, Input, Label, Textarea, toast } from "@stariva/ui";
import { Badge } from "@stariva/ui/reui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { orpc } from "~/orpc/react";

export interface CampaignFormValues {
  name: string;
  subject: string;
  previewText: string;
  heading: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  segment: EmailCampaignSegment;
}

export const EMPTY_CAMPAIGN: CampaignFormValues = {
  name: "",
  subject: "",
  previewText: "",
  heading: "",
  body: "Здравствуйте, это Ольга.\n\n",
  buttonLabel: "",
  buttonUrl: "",
  segment: { type: "workshop_buyers", workshops: [] },
};

/** Кому уйдёт письмо: курсы на выбор и список адресов. */
function SegmentPicker({
  segment,
  onChange,
}: {
  segment: EmailCampaignSegment;
  onChange: (segment: EmailCampaignSegment) => void;
}) {
  const audience = useQuery(
    orpc.admin.campaigns.audience.queryOptions({ input: { segment } }),
  );
  const members = audience.data?.members ?? [];
  const active = members.filter((member) => !member.suppressed);
  const toggle = (slug: string, checked: boolean) =>
    onChange({
      ...segment,
      workshops: checked
        ? [...segment.workshops, slug]
        : segment.workshops.filter((item) => item !== slug),
    });

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Получатели — купили мастер-класс</Label>
        <p className="text-muted-foreground text-xs">
          Ничего не отмечено — все, кто оплатил любой мастер-класс. Возвраты и
          неоплаченные заказы не считаются.
        </p>
        <div className="flex flex-col gap-2 pt-1">
          {audience.data?.workshops.map((workshop) => (
            <Label key={workshop.slug} className="font-normal">
              <Checkbox
                checked={segment.workshops.includes(workshop.slug)}
                onCheckedChange={(checked) =>
                  toggle(workshop.slug, checked === true)
                }
              />
              {workshop.title}
              <span className="text-muted-foreground">· {workshop.buyers}</span>
            </Label>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <p className="text-sm font-medium">
          {audience.isPending
            ? "Считаю получателей…"
            : `Письмо уйдёт ${active.length} ${plural(active.length)}`}
        </p>
        {members.length > active.length && (
          <p className="text-muted-foreground text-xs">
            Ещё {members.length - active.length} отписались — им не пришлю
          </p>
        )}
        {members.length > 0 && (
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm">
            {members.map((member) => (
              <li key={member.email} className="flex items-center gap-2">
                <span
                  className={
                    member.suppressed
                      ? "text-muted-foreground line-through"
                      : undefined
                  }
                >
                  {member.email}
                </span>
                {member.suppressed && (
                  <Badge variant="secondary">отписался</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function plural(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "человеку";
  return "людям";
}

/** Новая рассылка (без id) или правка черновика. */
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
    ...orpc.admin.campaigns.save.mutationOptions(),
    onSuccess: (result) => {
      toast.success(id ? "Сохранено" : "Черновик создан");
      if (!id) router.push(`/campaigns/${result.id}`);
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не сохранилось"),
  });

  const changed = JSON.stringify(values) !== JSON.stringify(initial);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ id, ...values });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="campaign-name">Название для себя</Label>
        <Input
          id="campaign-name"
          required
          maxLength={120}
          placeholder="Приглашение в Telegram-канал"
          value={values.name}
          onChange={(event) => set("name", event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="campaign-subject">Тема письма</Label>
        <Input
          id="campaign-subject"
          required
          maxLength={200}
          value={values.subject}
          onChange={(event) => set("subject", event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="campaign-preview">Строка рядом с темой</Label>
        <Input
          id="campaign-preview"
          maxLength={200}
          placeholder="Пусто — начало текста письма"
          value={values.previewText}
          onChange={(event) => set("previewText", event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="campaign-heading">Заголовок в письме</Label>
        <Input
          id="campaign-heading"
          required
          maxLength={200}
          value={values.heading}
          onChange={(event) => set("heading", event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="campaign-body">Текст</Label>
        <Textarea
          id="campaign-body"
          required
          rows={10}
          maxLength={10_000}
          value={values.body}
          onChange={(event) => set("body", event.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          Пустая строка — новый абзац. Ссылку лучше дать кнопкой ниже: по ней
          видно, кто перешёл.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <Label htmlFor="campaign-button-label">Текст кнопки</Label>
          <Input
            id="campaign-button-label"
            maxLength={60}
            placeholder="Перейти в канал"
            value={values.buttonLabel}
            onChange={(event) => set("buttonLabel", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="campaign-button-url">Ссылка кнопки</Label>
          <Input
            id="campaign-button-url"
            type="url"
            maxLength={2000}
            placeholder="https://t.me/…"
            value={values.buttonUrl}
            onChange={(event) => set("buttonUrl", event.target.value)}
          />
        </div>
      </div>

      <SegmentPicker
        segment={values.segment}
        onChange={(segment) => set("segment", segment)}
      />

      <Button
        type="submit"
        disabled={save.isPending || (id !== undefined && !changed)}
      >
        {save.isPending ? "Сохраняем…" : id ? "Сохранить" : "Создать черновик"}
      </Button>
    </form>
  );
}
