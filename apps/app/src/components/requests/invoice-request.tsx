"use client";

import type { RouterOutputs } from "@stariva/api";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
  toast,
} from "@stariva/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { orpc } from "~/orpc/react";

type Draft = RouterOutputs["admin"]["requests"]["orderDraft"];

/** Цена из поля ввода: запятая как разделитель; не число — null. */
function parseRubles(value: string): number | null {
  const number = Number(value.trim().replace(",", "."));
  return value.trim() !== "" && Number.isFinite(number) ? number : null;
}

/**
 * «Выставить счёт» по заявке: заказ под заказ на сайте с контактами и
 * изделием из заявки. После создания открывается заказ — там мастер
 * согласует условия, одобряет и отправляет покупателю ссылку на оплату.
 */
export function InvoiceRequest({ number }: { number: number }) {
  const [open, setOpen] = useState(false);
  const draft = useQuery({
    ...orpc.admin.requests.orderDraft.queryOptions({ input: { number } }),
    enabled: open,
  });
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Выставить счёт
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Счёт по заявке №{number}</DialogTitle>
            <DialogDescription>
              Заведём заказ под заказ на сайте. Дальше в заказе согласуете цену,
              доставку и срок, одобрите — и отправите покупателю ссылку на
              предоплату 50% через ЮKassa.
            </DialogDescription>
          </DialogHeader>
          {draft.data ? (
            <InvoiceForm number={number} draft={draft.data} />
          ) : draft.isError ? (
            <p className="text-destructive text-sm">
              {draft.error.message || "Не удалось разобрать заявку"}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">Разбираем заявку…</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function InvoiceForm({ number, draft }: { number: number; draft: Draft }) {
  const router = useRouter();
  const [form, setForm] = useState({
    contactName: draft.contactName,
    contactPhone: draft.contactPhone,
    contactEmail: draft.contactEmail,
    name: draft.name,
    price: draft.price > 0 ? String(draft.price) : "",
    size: draft.size,
    color: draft.color,
    comment: draft.comment,
  });
  // Ключ строки — чтобы удаление мерки не путало поля ввода соседних
  const [measurements, setMeasurements] = useState(() =>
    draft.measurements.map((m) => ({ ...m, key: crypto.randomUUID() })),
  );
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const create = useMutation({
    ...orpc.admin.orders.fromRequest.mutationOptions(),
    onSuccess: ({ id, number: orderNumber }) => {
      toast.success(
        `Заказ №${orderNumber} заведён — согласуйте условия и одобрите`,
      );
      router.push(`/orders/${id}`);
    },
    onError: (error: Error) => toast.error(error.message || "Не получилось"),
  });

  const price = parseRubles(form.price);
  const valid =
    form.contactName.trim() !== "" &&
    form.contactPhone.trim() !== "" &&
    form.name.trim() !== "" &&
    form.size.trim() !== "" &&
    form.color.trim() !== "" &&
    price !== null &&
    price > 0 &&
    measurements.every(
      (m) => m.label.trim() !== "" && parseRubles(m.value) !== null,
    );

  function submit() {
    if (!valid || price === null) return;
    create.mutate({
      number,
      ...form,
      productSlug: draft.productSlug,
      price,
      measurements: measurements.map((m) => ({
        label: m.label.trim(),
        value: m.value.trim(),
      })),
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Row id="invoice-name" label="Имя">
          <Input
            id="invoice-name"
            value={form.contactName}
            onChange={(e) => set("contactName")(e.target.value)}
          />
        </Row>
        <Row
          id="invoice-phone"
          label="Телефон"
          hint="По нему покупатель откроет заказ и оплатит"
        >
          <Input
            id="invoice-phone"
            inputMode="tel"
            placeholder="+7 999 123-45-67"
            value={form.contactPhone}
            onChange={(e) => set("contactPhone")(e.target.value)}
          />
        </Row>
        <Row
          id="invoice-email"
          label="Почта"
          hint="Необязательно: туда уйдут письма о статусе"
        >
          <Input
            id="invoice-email"
            type="email"
            value={form.contactEmail}
            onChange={(e) => set("contactEmail")(e.target.value)}
          />
        </Row>
        <Row
          id="invoice-price"
          label="Цена изделия, ₽"
          hint={
            draft.price > 0
              ? "Из каталога; итог поправите в заказе"
              : "Товара нет в каталоге — впишите оценку"
          }
        >
          <Input
            id="invoice-price"
            inputMode="decimal"
            value={form.price}
            onChange={(e) => set("price")(e.target.value)}
          />
        </Row>
      </div>

      <Row
        id="invoice-product"
        label="Изделие"
        hint={
          draft.productSlug
            ? `Из каталога: ${draft.productSlug}`
            : "Не из каталога"
        }
      >
        <Input
          id="invoice-product"
          value={form.name}
          onChange={(e) => set("name")(e.target.value)}
        />
      </Row>

      <div className="grid gap-3 sm:grid-cols-2">
        <Row id="invoice-size" label="Размер">
          <Input
            id="invoice-size"
            value={form.size}
            onChange={(e) => set("size")(e.target.value)}
          />
        </Row>
        <Row id="invoice-color" label="Цвет">
          <Input
            id="invoice-color"
            value={form.color}
            onChange={(e) => set("color")(e.target.value)}
          />
        </Row>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Мерки, см</legend>
        {measurements.map((m, index) => (
          <div key={m.key} className="flex items-center gap-2">
            <Input
              aria-label="Мерка"
              value={m.label}
              onChange={(e) =>
                setMeasurements((list) =>
                  list.map((item, i) =>
                    i === index ? { ...item, label: e.target.value } : item,
                  ),
                )
              }
            />
            <Input
              aria-label={`${m.label || "Мерка"}, см`}
              inputMode="decimal"
              className="w-24"
              value={m.value}
              onChange={(e) =>
                setMeasurements((list) =>
                  list.map((item, i) =>
                    i === index ? { ...item, value: e.target.value } : item,
                  ),
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Убрать мерку"
              onClick={() =>
                setMeasurements((list) => list.filter((_, i) => i !== index))
              }
            >
              ✕
            </Button>
          </div>
        ))}
        {measurements.length < 10 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setMeasurements((list) => [
                ...list,
                { label: "", value: "", key: crypto.randomUUID() },
              ])
            }
          >
            Добавить мерку
          </Button>
        )}
      </fieldset>

      <Row id="invoice-comment" label="Комментарий к изделию">
        <Textarea
          id="invoice-comment"
          rows={3}
          value={form.comment}
          onChange={(e) => set("comment")(e.target.value)}
        />
      </Row>

      <Button type="submit" disabled={!valid || create.isPending}>
        Завести заказ
      </Button>
    </form>
  );
}

function Row({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
