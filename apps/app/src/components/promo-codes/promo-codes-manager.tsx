"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  toast,
} from "@stariva/ui";
import { parseMoscowDateTime, promoCodeFormSchema } from "@stariva/validators";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { useConfirm } from "~/components/confirm-dialog";
import { orpc } from "~/orpc/react";

export type PromoCodeRow = {
  id: string;
  code: string;
  description: string;
  discountType: "percent" | "fixed";
  /** percent — проценты, fixed — копейки. */
  discountValue: number;
  active: boolean;
  /** Формат input datetime-local по Москве; пустая строка — без ограничения. */
  startsAt: string;
  endsAt: string;
  usageLimit: number | null;
  /** Копейки. */
  minOrderAmount: number | null;
  usedCount: number;
  createdAt: string;
};

type FormState = {
  id?: string;
  code: string;
  description: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  active: boolean;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  minOrderAmount: string;
};

const EMPTY_FORM: FormState = {
  code: "",
  description: "",
  discountType: "percent",
  discountValue: "10",
  active: true,
  startsAt: "",
  endsAt: "",
  usageLimit: "",
  minOrderAmount: "",
};

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

const selectClass =
  "border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : (
        hint && <p className="text-muted-foreground text-xs">{hint}</p>
      )}
    </div>
  );
}

function discountLabel(row: PromoCodeRow): string {
  return row.discountType === "percent"
    ? `${row.discountValue}%`
    : rub.format(row.discountValue / 100);
}

function dateLabel(value: string): string {
  const date = parseMoscowDateTime(value);
  return date ? dateFormat.format(date) : "—";
}

function status(row: PromoCodeRow): { label: string; active: boolean } {
  const now = new Date();
  const startsAt = row.startsAt ? parseMoscowDateTime(row.startsAt) : null;
  const endsAt = row.endsAt ? parseMoscowDateTime(row.endsAt) : null;
  if (!row.active) return { label: "Выключен", active: false };
  if (startsAt && startsAt > now) {
    return { label: "Ещё не начался", active: false };
  }
  if (endsAt && endsAt <= now) return { label: "Истёк", active: false };
  if (row.usageLimit !== null && row.usedCount >= row.usageLimit) {
    return { label: "Лимит исчерпан", active: false };
  }
  return { label: "Действует", active: true };
}

function formFromRow(row: PromoCodeRow): FormState {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    discountType: row.discountType,
    discountValue:
      row.discountType === "percent"
        ? String(row.discountValue)
        : String(row.discountValue / 100),
    active: row.active,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    usageLimit: row.usageLimit === null ? "" : String(row.usageLimit),
    minOrderAmount:
      row.minOrderAmount === null ? "" : String(row.minOrderAmount / 100),
  };
}

function PromoForm({
  initial,
  onCancel,
}: {
  initial: FormState;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    ...orpc.admin.promoCodes.save.mutationOptions(),
    onSuccess: () => {
      toast.success(values.id ? "Промокод сохранён" : "Промокод создан");
      router.refresh();
      onCancel();
    },
    onError: (error: Error) => toast.error(error.message || "Не сохранилось"),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  function submit() {
    const parsed = promoCodeFormSchema.safeParse({
      code: values.code,
      description: values.description,
      discountType: values.discountType,
      discountValue: Number(values.discountValue),
      active: values.active,
      startsAt: values.startsAt,
      endsAt: values.endsAt,
      usageLimit: values.usageLimit.trim() ? Number(values.usageLimit) : null,
      minOrderAmount: values.minOrderAmount.trim()
        ? Number(values.minOrderAmount)
        : null,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      toast.error("Проверьте поля формы");
      return;
    }
    save.mutate({ id: values.id, values: parsed.data });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {values.id ? "Редактировать промокод" : "Новый промокод"}
        </CardTitle>
        <CardDescription>
          Скидка применяется только к стоимости изделий новогоднего набора,
          доставка не уменьшается.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Код" htmlFor="promo-code" error={errors.code}>
            <Input
              id="promo-code"
              value={values.code}
              onChange={(event) =>
                set("code", event.target.value.toUpperCase())
              }
              placeholder="NEWYEAR"
              className="font-mono uppercase"
              maxLength={40}
            />
          </Field>
          <Field label="Вид скидки" htmlFor="promo-discount-type">
            <select
              id="promo-discount-type"
              className={selectClass}
              value={values.discountType}
              onChange={(event) =>
                set("discountType", event.target.value as "percent" | "fixed")
              }
            >
              <option value="percent">Процент</option>
              <option value="fixed">Фиксированная сумма</option>
            </select>
          </Field>
          <Field
            label={
              values.discountType === "percent" ? "Скидка, %" : "Скидка, ₽"
            }
            htmlFor="promo-discount-value"
            error={errors.discountValue}
          >
            <Input
              id="promo-discount-value"
              type="number"
              min="0"
              step={values.discountType === "percent" ? "1" : "0.01"}
              value={values.discountValue}
              onChange={(event) => set("discountValue", event.target.value)}
            />
          </Field>
          <Field
            label="Минимальный заказ, ₽"
            htmlFor="promo-min-order"
            hint="Пусто — без минимальной суммы"
            error={errors.minOrderAmount}
          >
            <Input
              id="promo-min-order"
              type="number"
              min="0"
              step="0.01"
              value={values.minOrderAmount}
              onChange={(event) => set("minOrderAmount", event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field
            label="Начало действия"
            htmlFor="promo-starts-at"
            hint="По Москве; пусто — сразу"
            error={errors.startsAt}
          >
            <Input
              id="promo-starts-at"
              type="datetime-local"
              value={values.startsAt}
              onChange={(event) => set("startsAt", event.target.value)}
            />
          </Field>
          <Field
            label="Окончание действия"
            htmlFor="promo-ends-at"
            hint="По Москве; пусто — бессрочно"
            error={errors.endsAt}
          >
            <Input
              id="promo-ends-at"
              type="datetime-local"
              value={values.endsAt}
              onChange={(event) => set("endsAt", event.target.value)}
            />
          </Field>
          <Field
            label="Лимит использований"
            htmlFor="promo-usage-limit"
            hint="Пусто — без лимита"
            error={errors.usageLimit}
          >
            <Input
              id="promo-usage-limit"
              type="number"
              min="1"
              step="1"
              value={values.usageLimit}
              onChange={(event) => set("usageLimit", event.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Внутренняя пометка"
          htmlFor="promo-description"
          error={errors.description}
        >
          <Textarea
            id="promo-description"
            value={values.description}
            onChange={(event) => set("description", event.target.value)}
            placeholder="Например, рассылка подписчикам в декабре"
            maxLength={300}
            rows={2}
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Switch
              id="promo-active"
              checked={values.active}
              onCheckedChange={(checked) => set("active", checked)}
            />
            <Label htmlFor="promo-active">Промокод включён</Label>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Отмена
            </Button>
            <Button type="button" disabled={save.isPending} onClick={submit}>
              {save.isPending ? "Сохраняем…" : "Сохранить"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Список промокодов и форма их создания/редактирования. */
export function PromoCodesManager({ rows }: { rows: PromoCodeRow[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<FormState | null>(null);

  const remove = useMutation({
    ...orpc.admin.promoCodes.remove.mutationOptions(),
    onSuccess: () => {
      toast.success("Промокод удалён");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не удалилось"),
  });

  async function confirmRemove(row: PromoCodeRow) {
    if (
      await confirm({
        title: `Удалить промокод ${row.code}?`,
        description:
          "Новые заказы не смогут его применить. В уже созданных заказах скидка и код сохранятся.",
        confirmLabel: "Удалить",
        destructive: true,
      })
    ) {
      remove.mutate({ id: row.id });
    }
  }

  return (
    <div className="space-y-4">
      {editing ? (
        <PromoForm
          key={editing.id ?? "new"}
          initial={editing}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <div>
          <Button onClick={() => setEditing(EMPTY_FORM)}>Новый промокод</Button>
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Код</TableHead>
              <TableHead>Скидка</TableHead>
              <TableHead>Ограничения</TableHead>
              <TableHead>Использования</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Пометка</TableHead>
              <TableHead>
                <span className="sr-only">Действия</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground py-8 text-center"
                >
                  Промокодов пока нет
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => {
              const rowStatus = status(row);
              return (
                <TableRow key={row.id}>
                  <TableCell className="align-top font-mono font-medium whitespace-nowrap">
                    {row.code}
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap">
                    {discountLabel(row)}
                  </TableCell>
                  <TableCell className="max-w-[280px] align-top text-sm whitespace-normal">
                    <div>
                      {row.minOrderAmount !== null
                        ? `от ${rub.format(row.minOrderAmount / 100)}`
                        : "без минимальной суммы"}
                    </div>
                    <div className="text-muted-foreground">
                      {row.startsAt || row.endsAt
                        ? `${row.startsAt ? dateLabel(row.startsAt) : "сразу"} — ${row.endsAt ? dateLabel(row.endsAt) : "бессрочно"}`
                        : "бессрочно"}
                    </div>
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap tabular-nums">
                    {row.usedCount}
                    {row.usageLimit !== null ? ` / ${row.usageLimit}` : ""}
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant={rowStatus.active ? "default" : "secondary"}>
                      {rowStatus.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[220px] align-top text-sm whitespace-normal">
                    {row.description || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(formFromRow(row))}
                      >
                        Изменить
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={remove.isPending}
                        onClick={() => confirmRemove(row)}
                      >
                        Удалить
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
