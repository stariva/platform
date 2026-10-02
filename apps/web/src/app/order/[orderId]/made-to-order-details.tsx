"use client";

import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { measurementEntrySchema } from "@/lib/commerce/made-to-order-options";
import { CUSTOM_SIZE, OWN_SIZE } from "@/lib/made-to-order";

export const madeToOrderItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().int().nonnegative(),
  options: z
    .object({
      size: z.string(),
      color: z.string(),
      measurements: z.array(z.object({ label: z.string(), value: z.string() })),
      comment: z.string().optional(),
    })
    .nullable(),
  measurementFields: z.array(
    z.object({ id: z.string(), label: z.string(), hint: z.string() }),
  ),
});

type OrderItem = z.infer<typeof madeToOrderItemSchema>;

interface Props {
  orderId: string;
  phone: string;
  items: OrderItem[];
  customerNotes: string | null;
  deliveryNote: string | null;
  onSaved: () => Promise<void> | void;
}

const isCustomSize = (size: string) =>
  size === CUSTOM_SIZE || size === OWN_SIZE;

/**
 * Дополнение оплаченного заказа под заказ: мерки по изделиям, пожелания и
 * куда отправить. Размер и цвет уже оплачены — их меняет только мастер.
 */
export function MadeToOrderDetails({
  orderId,
  phone,
  items,
  customerNotes,
  deliveryNote,
  onSaved,
}: Props) {
  // Значения мерок по изделию и подписи: старые мерки подставляем в поля.
  const [measures, setMeasures] = useState<
    Record<string, Record<string, string>>
  >(() =>
    Object.fromEntries(
      items.map((item) => [
        item.id,
        Object.fromEntries(
          (item.options?.measurements ?? []).map((m) => [m.label, m.value]),
        ),
      ]),
    ),
  );
  const [comments, setComments] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items.map((item) => [item.id, item.options?.comment ?? ""]),
    ),
  );
  const [notes, setNotes] = useState(customerNotes ?? "");
  const [delivery, setDelivery] = useState(deliveryNote ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function setMeasure(itemId: string, label: string, value: string) {
    setMeasures((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [label]: value },
    }));
    setErrors((prev) => {
      const { [`${itemId}:${label}`]: _removed, ...rest } = prev;
      return rest;
    });
  }

  async function save() {
    const nextErrors: Record<string, string> = {};
    const payloadItems = items.map((item) => {
      const entries = Object.entries(measures[item.id] ?? {})
        .map(([label, value]) => ({ label, value: value.trim() }))
        .filter((entry) => entry.value !== "");
      for (const entry of entries) {
        if (!measurementEntrySchema.safeParse(entry).success) {
          nextErrors[`${item.id}:${entry.label}`] = "Введите число, см";
        }
      }
      return {
        id: item.id,
        measurements: entries,
        comment: comments[item.id]?.trim() || undefined,
      };
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          items: payloadItems,
          customerNotes: notes.trim(),
          deliveryNote: delivery.trim(),
        }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const error = z.object({ error: z.string() }).safeParse(data);
        toast.error(
          error.success ? error.data.error : "Не удалось сохранить детали",
        );
        return;
      }
      toast.success("Спасибо! Мастер увидит ваши уточнения.");
      await onSaved();
    } catch {
      toast.error("Не удалось сохранить детали. Попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-espresso/8 pt-4 space-y-5">
      <div>
        <p className="label-caps text-terracotta text-xs mb-1">
          Уточните детали
        </p>
        <p className="text-taupe text-xs leading-relaxed">
          Можно заполнить сейчас или обсудить с мастером — он свяжется с вами
          сам. Размер и цвет, выбранные при оплате, мастер подтвердит с вами
          перед началом работы.
        </p>
      </div>

      {items.map((item) => (
        <fieldset key={item.id} className="space-y-3">
          <legend className="text-espresso text-sm font-medium">
            {item.name}
            {item.options && ` · ${item.options.size} · ${item.options.color}`}
          </legend>

          {item.options && isCustomSize(item.options.size) && (
            <div className="grid grid-cols-2 gap-3">
              {item.measurementFields.map((field) => {
                const key = `${item.id}:${field.label}`;
                return (
                  <div key={field.id} className="space-y-1">
                    <Label htmlFor={key} className="text-[12px]">
                      {field.label}, см
                    </Label>
                    <Input
                      id={key}
                      inputMode="decimal"
                      title={field.hint}
                      value={measures[item.id]?.[field.label] ?? ""}
                      aria-invalid={Boolean(errors[key])}
                      onChange={(e) =>
                        setMeasure(item.id, field.label, e.target.value)
                      }
                    />
                    {errors[key] && (
                      <p className="text-[12px] text-destructive">
                        {errors[key]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor={`${item.id}:comment`} className="text-[12px]">
              Комментарий к изделию
            </Label>
            <Textarea
              id={`${item.id}:comment`}
              rows={2}
              placeholder="Посадка, длина, оттенок шнура…"
              value={comments[item.id] ?? ""}
              onChange={(e) =>
                setComments((prev) => ({ ...prev, [item.id]: e.target.value }))
              }
            />
          </div>
        </fieldset>
      ))}

      <div className="space-y-1">
        <Label htmlFor="order-delivery" className="text-[12px]">
          Куда и как отправить
        </Label>
        <Textarea
          id="order-delivery"
          rows={2}
          placeholder="Город, адрес или пункт выдачи, удобная служба доставки"
          value={delivery}
          onChange={(e) => setDelivery(e.target.value)}
        />
        <p className="text-taupe text-[11px]">
          Стоимость доставки не входит в оплату — мастер согласует её с вами.
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="order-notes" className="text-[12px]">
          Общие пожелания
        </Label>
        <Textarea
          id="order-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <Button
        type="button"
        onClick={save}
        disabled={saving}
        className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark"
      >
        {saving ? <Spinner /> : "Сохранить детали"}
      </Button>
    </div>
  );
}
