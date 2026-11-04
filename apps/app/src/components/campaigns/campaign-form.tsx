"use client";

import type { EmailCampaignSegment } from "@stariva/db/schema";
import type { CampaignTemplateId } from "@stariva/emails";
import {
  Button,
  Checkbox,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  toast,
} from "@stariva/ui";
import { Badge } from "@stariva/ui/reui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { orpc } from "~/orpc/react";
import type {
  CampaignFormValues,
  CampaignTemplateOption,
} from "./campaign-meta";
import { useDraftState } from "./draft-state";

/** Выбор готового письма: название, о чём оно и тема во «Входящих». */
function TemplatePicker({
  templates,
  value,
  onChange,
}: {
  templates: CampaignTemplateOption[];
  value: CampaignTemplateId;
  onChange: (value: CampaignTemplateId) => void;
}) {
  const labelId = useId();
  return (
    <div className="space-y-1.5">
      <Label id={labelId}>Письмо</Label>
      <RadioGroup
        aria-labelledby={labelId}
        value={value}
        onValueChange={(next) => onChange(next as CampaignTemplateId)}
      >
        {templates.map((template) => (
          <Label
            key={template.id}
            className="has-[[data-checked]]:border-primary items-start gap-3 rounded-lg border p-3 font-normal"
          >
            <RadioGroupItem value={template.id} className="mt-0.5" />
            <span className="space-y-1">
              <span className="block font-medium">{template.label}</span>
              <span className="text-muted-foreground block text-xs leading-snug">
                {template.description}
              </span>
              <span className="block text-xs leading-snug">
                <span className="text-muted-foreground">Тема: </span>
                {template.subject}
              </span>
            </span>
          </Label>
        ))}
      </RadioGroup>
      <p className="text-muted-foreground text-xs">
        Тексты писем готовые и живут в коде. Новое письмо добавляет разработчик
        — оно появится в этом списке.
      </p>
    </div>
  );
}

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

/**
 * Новая рассылка (без id) или правка черновика. Страница черновика
 * пересоздаёт форму после сохранения (key по updatedAt), чтобы в ней были
 * значения из базы, а не введённые.
 */
export function CampaignForm({
  id,
  initial,
  templates,
}: {
  id?: string;
  initial: CampaignFormValues;
  templates: CampaignTemplateOption[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const template = templates.find((item) => item.id === values.template);
  const setParam = (name: string, value: string) =>
    setValues((current) => ({
      ...current,
      params: { ...current.params, [name]: value },
    }));
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
  const setDirty = useDraftState()?.setDirty;
  useEffect(() => setDirty?.(changed), [changed, setDirty]);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        // Только поля выбранного письма: от другого шаблона могли остаться
        const params = Object.fromEntries(
          (template?.fields ?? []).map((field) => [
            field.name,
            values.params[field.name] ?? "",
          ]),
        );
        save.mutate({ id, ...values, params });
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

      <TemplatePicker
        templates={templates}
        value={values.template}
        onChange={(next) => set("template", next)}
      />

      {template?.fields.map((field) => (
        <div key={field.name} className="space-y-1.5">
          <Label htmlFor={`campaign-param-${field.name}`}>{field.label}</Label>
          <Input
            id={`campaign-param-${field.name}`}
            type={field.type}
            required
            maxLength={2000}
            placeholder={field.placeholder}
            value={values.params[field.name] ?? ""}
            onChange={(event) => setParam(field.name, event.target.value)}
          />
          {field.hint && (
            <p className="text-muted-foreground text-xs">{field.hint}</p>
          )}
        </div>
      ))}

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
