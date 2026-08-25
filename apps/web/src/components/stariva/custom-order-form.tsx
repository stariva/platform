"use client";

import { motion } from "motion/react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  COLORS,
  COMPLEXITIES,
  calculatePrice,
  PRODUCT_TYPES,
  type PriceSelection,
  SIZES,
} from "@/lib/custom-order/pricing";
import { PriceCalculator } from "./price-calculator";

interface AiEstimate {
  designSummary: string;
  suggestions: string[];
  estimatedMin: number;
  estimatedMax: number;
  productionDays: string;
  note: string;
}

const labelOf = (
  list: ReadonlyArray<{ id: string; label: string }>,
  id?: string,
) => list.find((x) => x.id === id)?.label;

export function CustomOrderForm() {
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selection, setSelection] = useState<Partial<PriceSelection>>({});
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiEstimate, setAiEstimate] = useState<AiEstimate | null>(null);

  const estimate = calculatePrice(selection);

  async function handleAskAi() {
    if (description.trim().length < 3) {
      toast.error("Сначала опишите, что вы хотите заказать");
      return;
    }
    setAiLoading(true);
    setAiEstimate(null);
    try {
      const res = await fetch("/api/ai/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          budget: budget || undefined,
          ...selection,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(
          data?.code === "not_configured"
            ? "AI-помощник пока не подключён"
            : (data?.error ?? "Не удалось получить ответ AI"),
        );
        return;
      }
      setAiEstimate(data as AiEstimate);
    } catch {
      toast.error("Ошибка соединения с AI-помощником");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Укажите ваше имя");
      return;
    }
    if (contact.trim().length < 3) {
      toast.error("Укажите контакт для связи (Telegram, телефон или email)");
      return;
    }
    if (description.trim().length < 5) {
      toast.error("Опишите, что вы хотите заказать");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("contact", contact);
      fd.append("description", description);
      if (budget) fd.append("budget", budget);
      if (selection.productType)
        fd.append(
          "productType",
          labelOf(PRODUCT_TYPES, selection.productType) ?? "",
        );
      if (selection.size)
        fd.append("size", labelOf(SIZES, selection.size) ?? "");
      if (selection.color)
        fd.append("color", labelOf(COLORS, selection.color) ?? "");
      if (selection.complexity)
        fd.append(
          "complexity",
          labelOf(COMPLEXITIES, selection.complexity) ?? "",
        );
      if (estimate) {
        fd.append("estimateMin", String(estimate.min));
        fd.append("estimateMax", String(estimate.max));
      }
      if (photo) fd.append("photo", photo);

      const res = await fetch("/api/custom-order", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Не удалось отправить заявку");
        return;
      }

      toast.success("Заявка отправлена! Свяжемся с вами в рабочее время.");
      setName("");
      setContact("");
      setDescription("");
      setBudget("");
      setPhoto(null);
      setAiEstimate(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      toast.error(
        "Ошибка соединения. Попробуйте ещё раз или напишите в Telegram.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-espresso/10 border border-espresso/10 rounded-sm overflow-hidden">
      {/* ── Калькулятор ── */}
      <div className="bg-parchment p-7 lg:p-9">
        <div className="label-caps text-terracotta text-[12px] mb-5">
          Калькулятор стоимости
        </div>
        <PriceCalculator selection={selection} onChange={setSelection} />
      </div>

      {/* ── Форма заявки ── */}
      <form
        onSubmit={handleSubmit}
        className="bg-parchment p-7 lg:p-9 flex flex-col gap-5"
      >
        <div className="label-caps text-terracotta text-[12px]">
          Заявка на заказ
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-name`}>Имя</Label>
            <Input
              id={`${formId}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Как к вам обращаться"
              autoComplete="name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-contact`}>
              Telegram / телефон / email
            </Label>
            <Input
              id={`${formId}-contact`}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="@username или +7…"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-desc`}>Что хотите заказать</Label>
          <Textarea
            id={`${formId}-desc`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Опишите изделие: назначение, стиль, особые пожелания…"
            rows={4}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-budget`}>Бюджет (необязательно)</Label>
            <Input
              id={`${formId}-budget`}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="например, до 5000 ₽"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-photo`}>Фото-вдохновение</Label>
            <Input
              ref={fileInputRef}
              id={`${formId}-photo`}
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="file:text-espresso/70 file:mr-3 cursor-pointer"
            />
          </div>
        </div>

        {/* AI-помощник */}
        <div className="rounded-sm border border-espresso/12 bg-sand/60 p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-espresso text-sm font-medium">
                AI-помощник по заказу
              </p>
              <p className="text-taupe text-[12px] leading-relaxed mt-0.5 max-w-xs">
                Подберёт идеи дизайна и уточнит примерную стоимость по вашему
                описанию.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleAskAi}
              disabled={aiLoading}
              className="rounded-full border-espresso/25 text-espresso hover:bg-espresso hover:text-parchment shrink-0"
            >
              {aiLoading ? "Думаю…" : "Спросить AI"}
            </Button>
          </div>

          {aiEstimate ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 pt-4 border-t border-espresso/10 space-y-3"
            >
              <p className="text-espresso/85 text-sm leading-relaxed">
                {aiEstimate.designSummary}
              </p>
              <ul className="space-y-1.5">
                {aiEstimate.suggestions.map((s) => (
                  <li
                    key={s}
                    className="flex gap-2 text-espresso/70 text-[13px] leading-snug"
                  >
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-terracotta shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] pt-1">
                <span className="text-espresso">
                  <span className="text-taupe">Оценка AI: </span>~
                  {aiEstimate.estimatedMin.toLocaleString("ru-RU")}–
                  {aiEstimate.estimatedMax.toLocaleString("ru-RU")} ₽
                </span>
                <span className="text-espresso">
                  <span className="text-taupe">Срок: </span>
                  {aiEstimate.productionDays}
                </span>
              </div>
              <p className="text-taupe text-[11px] leading-relaxed">
                {aiEstimate.note}
              </p>
            </motion.div>
          ) : null}
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="mt-1 rounded-full bg-terracotta text-parchment hover:bg-espresso h-12 label-caps-md"
        >
          {submitting ? "Отправляем…" : "Отправить заявку"}
        </Button>
        <p className="text-taupe text-[11px] leading-relaxed text-center">
          Нажимая «Отправить», вы соглашаетесь на обработку персональных данных.
        </p>
      </form>
    </div>
  );
}
