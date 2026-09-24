"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { reachGoal } from "@/lib/analytics";
import { appendCampaign } from "@/lib/campaign-attribution";
import {
  COLORS,
  COMPLEXITIES,
  calculatePrice,
  PRODUCT_TYPES,
  SIZES,
} from "@/lib/custom-order/pricing";
import { validatePhoto } from "@/lib/custom-order/schema";
import {
  ConsentCheckbox,
  PD_CONSENT_ERROR,
  PersonalDataConsentLabel,
} from "./consent-checkbox";
import { useHomeOrder } from "./home-order-context";
import { PriceCalculator } from "./price-calculator";

const schema = z.object({
  contact: z
    .string()
    .trim()
    .min(3, "Укажите Telegram, телефон или email")
    .max(200),
  description: z
    .string()
    .trim()
    .min(5, "Коротко опишите, что хотите заказать")
    .max(3000),
  name: z.string().trim().max(120),
  measurements: z.string().trim().max(500),
  budget: z.string().trim().max(100),
  measurementHelp: z.boolean(),
  personalDataConsent: z.boolean().refine(Boolean, PD_CONSENT_ERROR),
});
type Values = z.infer<typeof schema>;
const defaults: Values = {
  contact: "",
  description: "",
  name: "",
  measurements: "",
  budget: "",
  measurementHelp: false,
  personalDataConsent: false,
};
const fieldClass =
  "mt-2 block w-full rounded-xl border border-espresso/20 bg-parchment px-4 py-3 text-base text-espresso placeholder:text-taupe/80 focus:outline-none focus:ring-2 focus:ring-terracotta/40 disabled:opacity-60";
const hints: Record<string, string> = {
  lampshade: "Диаметр и высота абажура в см; если знаете — тип крепления.",
  clothes:
    "Рост, обхват груди, талии и бёдер, желаемая длина в см. Можно прислать позже.",
  bag: "Ширина, высота, глубина и длина ручек или ремня в см.",
  panel: "Ширина и высота панно в см, с бахромой или без неё.",
  tipi: "Ширина основания, высота и место установки в см.",
  "plant-hanger": "Диаметр горшка и желаемая длина подвеса в см.",
  placemat: "Диаметр или ширина × длина в см, количество изделий.",
};

export function CustomOrderForm() {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const started = useRef(false);
  const locked = useRef(false);
  const { selection, setSelection } = useHomeOrder();
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const estimate = calculatePrice(selection);
  const nameOf = (options: { id: string; label: string }[], value?: string) =>
    options.find((item) => item.id === value)?.label ?? "";
  const start = () => {
    if (!started.current) {
      reachGoal("custom_order_started", { location: "homepage" });
      started.current = true;
    }
  };
  async function submit(values: Values) {
    if (locked.current || photoError) return;
    locked.current = true;
    setSubmitting(true);
    setError("");
    try {
      const fd = new FormData();
      for (const [key, value] of Object.entries(values))
        fd.append(key, String(value));
      fd.append(
        "website",
        String(
          document.getElementById(`${id}-website`) instanceof HTMLInputElement
            ? (document.getElementById(`${id}-website`) as HTMLInputElement)
                .value
            : "",
        ),
      );
      for (const [key, value] of Object.entries({
        productType: nameOf(PRODUCT_TYPES, selection.productType),
        size:
          selection.productType === "clothes"
            ? "По меркам"
            : nameOf(SIZES, selection.size),
        color: nameOf(COLORS, selection.color),
        complexity: nameOf(COMPLEXITIES, selection.complexity),
      }))
        if (value) fd.append(key, value);
      if (estimate) {
        fd.append("estimateMin", String(estimate.min));
        fd.append("estimateMax", String(estimate.max));
      }
      if (photo) fd.append("photo", photo);
      appendCampaign(fd);
      const signature = JSON.stringify({
        fields: [...fd.entries()].filter(([key]) => key !== "photo"),
        photo: photo ? [photo.name, photo.size, photo.lastModified] : null,
      });
      if (request.current?.signature !== signature)
        request.current = { signature, id: crypto.randomUUID() };
      fd.append("requestId", request.current.id);
      const response = await fetch("/api/custom-order", {
        method: "POST",
        body: fd,
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !data.requestId) {
        if (response.status === 409) request.current = null;
        setError(
          data.error ??
            "Не удалось принять заявку. Попробуйте ещё раз или напишите мастеру.",
        );
        reachGoal("custom_order_error", { reason: "server" });
        return;
      }
      setSuccess(data.requestId);
      reachGoal("custom_order_submitted", { location: "homepage" });
      form.reset(defaults);
      setPhoto(null);
      setSelection({});
      if (fileInput.current) fileInput.current.value = "";
    } catch {
      setError(
        "Не удалось подтвердить приём заявки. Данные сохранены в форме — повторите отправку или напишите в Telegram.",
      );
      reachGoal("custom_order_error", { reason: "network" });
    } finally {
      locked.current = false;
      setSubmitting(false);
    }
  }
  async function askAi() {
    const description = form.getValues("description");
    if (description.length < 5) {
      setAiText("Сначала опишите вашу идею в форме выше.");
      return;
    }
    setAiLoading(true);
    try {
      const response = await fetch("/api/ai/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, ...selection }),
      });
      const data = await response.json();
      setAiText(
        response.ok
          ? `${data.designSummary}\n${(data.suggestions ?? []).join("\n")}`
          : "Помощник сейчас недоступен. Отправьте заявку — Ольга поможет с выбором.",
      );
    } catch {
      setAiText(
        "Помощник сейчас недоступен. Вы можете отправить заявку мастеру.",
      );
    } finally {
      setAiLoading(false);
    }
  }
  if (success)
    return (
      <div
        role="status"
        className="rounded-2xl border border-espresso/10 bg-parchment p-6 lg:p-8"
      >
        <p className="label-caps text-terracotta">Заявка принята</p>
        <h3 className="mt-3 font-serif text-3xl text-espresso">
          Спасибо за вашу идею!
        </h3>
        <p className="mt-4 text-espresso/75 leading-relaxed">
          Мы сохранили заявку. Мастер свяжется с вами по указанному контакту в
          рабочее время: пн–сб, 10:00–20:00 МСК.
        </p>
        <p className="mt-4 text-xs text-taupe break-all">
          Номер заявки: {success}
        </p>
        <a
          href="https://t.me/Olga_Stariva"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-block text-terracotta underline underline-offset-4"
        >
          Добавить детали в Telegram
        </a>
        <button
          type="button"
          onClick={() => {
            setSuccess("");
            request.current = null;
            started.current = false;
            setAiText("");
          }}
          className="mt-5 block text-sm underline underline-offset-4"
        >
          Обсудить ещё одно изделие
        </button>
      </div>
    );
  return (
    <div className="rounded-2xl border border-espresso/10 bg-parchment p-5 sm:p-7 lg:p-8">
      <form
        onSubmit={form.handleSubmit(submit)}
        onFocusCapture={start}
        noValidate
      >
        <fieldset disabled={submitting} className="space-y-5">
          <legend className="font-serif text-2xl text-espresso mb-5">
            Получить расчёт от мастера
          </legend>
          <label htmlFor={`${id}-type`} className="block text-sm text-espresso">
            Что будем создавать?
            <select
              id={`${id}-type`}
              value={selection.productType ?? ""}
              onChange={(e) =>
                setSelection({
                  ...selection,
                  productType: e.target.value,
                  size: undefined,
                })
              }
              className={fieldClass}
            >
              <option value="">Пока выбираю</option>
              {PRODUCT_TYPES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label
            htmlFor={`${id}-description`}
            className="block text-sm text-espresso"
          >
            Ваша идея
            <textarea
              id={`${id}-description`}
              {...form.register("description")}
              maxLength={3000}
              rows={3}
              placeholder={
                selection.productType === "clothes"
                  ? "Например: молочная туника для отпуска, длина до колена. Нужна помощь с мерками."
                  : "Расскажите об изделии: цвет, размер и детали, которые вам нравятся."
              }
              className={fieldClass}
              aria-invalid={!!form.formState.errors.description}
              aria-describedby={`${id}-description-error`}
            />
            <span
              id={`${id}-description-error`}
              className="text-red-700 text-sm"
            >
              {form.formState.errors.description?.message}
            </span>
          </label>
          <label
            htmlFor={`${id}-contact`}
            className="block text-sm text-espresso"
          >
            Куда ответить: Telegram, телефон или email
            <input
              id={`${id}-contact`}
              {...form.register("contact")}
              maxLength={200}
              placeholder="@username, +7… или email"
              className={fieldClass}
              aria-invalid={!!form.formState.errors.contact}
              aria-describedby={`${id}-contact-error`}
            />
            <span id={`${id}-contact-error`} className="text-red-700 text-sm">
              {form.formState.errors.contact?.message}
            </span>
          </label>
          <details className="rounded-xl border border-espresso/15 px-4 py-3">
            <summary className="cursor-pointer text-sm text-espresso py-1">
              Размеры, фото и пожелания{" "}
              <span className="text-taupe">· необязательно</span>
            </summary>
            <div className="pt-4 space-y-4">
              <label htmlFor={`${id}-measurements`} className="block text-sm">
                Размеры или мерки, см
                <textarea
                  id={`${id}-measurements`}
                  {...form.register("measurements")}
                  rows={2}
                  maxLength={500}
                  placeholder={
                    hints[selection.productType ?? ""] ??
                    "Укажите желаемые размеры. Если пока не знаете — поможем."
                  }
                  className={fieldClass}
                />
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  {...form.register("measurementHelp")}
                  className="size-4 accent-terracotta"
                />
                Не знаю размеры — нужна помощь
              </label>
              <label htmlFor={`${id}-photo`} className="block text-sm">
                Фото изделия или места, где оно будет
                <input
                  ref={fileInput}
                  id={`${id}-photo`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className={`${fieldClass} file:mr-3 file:text-sm`}
                  onChange={(e) => {
                    const selected = e.target.files?.[0] ?? null;
                    const problem = selected ? validatePhoto(selected) : null;
                    setPhotoError(problem ?? "");
                    setPhoto(problem ? null : selected);
                    if (problem) e.target.value = "";
                  }}
                />
                <span className="mt-1 block text-xs text-taupe">
                  JPG, PNG или WebP, до 8 МБ
                </span>
                {photoError && (
                  <span role="alert" className="text-sm text-red-700">
                    {photoError}
                  </span>
                )}
              </label>
              {(photo || photoError) && (
                <button
                  type="button"
                  className="text-sm underline underline-offset-4"
                  onClick={() => {
                    setPhoto(null);
                    setPhotoError("");
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                >
                  Продолжить без фото
                </button>
              )}
              <label htmlFor={`${id}-name`} className="block text-sm">
                Как к вам обращаться
                <input
                  id={`${id}-name`}
                  {...form.register("name")}
                  maxLength={120}
                  autoComplete="name"
                  className={fieldClass}
                />
              </label>
              <label htmlFor={`${id}-budget`} className="block text-sm">
                Бюджет
                <input
                  id={`${id}-budget`}
                  {...form.register("budget")}
                  maxLength={100}
                  placeholder="Например, до 10 000 ₽"
                  className={fieldClass}
                />
              </label>
            </div>
          </details>
          <div hidden aria-hidden="true">
            <label htmlFor={`${id}-website`}>Website</label>
            <input
              id={`${id}-website`}
              name="website"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>
          <ConsentCheckbox
            checked={form.watch("personalDataConsent")}
            onCheckedChange={(value) =>
              form.setValue("personalDataConsent", value === true, {
                shouldValidate: true,
              })
            }
            error={form.formState.errors.personalDataConsent?.message}
          >
            <PersonalDataConsentLabel />
          </ConsentCheckbox>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
            >
              {error}{" "}
              <a href="https://t.me/Olga_Stariva" className="underline">
                Написать в Telegram
              </a>
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || !!photoError}
            className="w-full min-h-12 rounded-full bg-terracotta px-5 py-3 text-parchment text-sm font-medium transition-colors hover:bg-espresso disabled:opacity-60"
          >
            {submitting ? "Сохраняем заявку…" : "Получить расчёт"}
          </button>
          <p className="text-xs leading-relaxed text-taupe">
            Заявка без оплаты. Стоимость, срок и доставку согласуем лично.
            Источник перехода с рекламы может быть передан вместе с заявкой.
          </p>
        </fieldset>
      </form>
      <details
        className="mt-6 border-t border-espresso/10 pt-4"
        onToggle={(e) => {
          if (e.currentTarget.open) reachGoal("custom_order_calculator_open");
        }}
      >
        <summary className="cursor-pointer text-sm text-espresso py-2">
          Хочу сначала прикинуть стоимость
        </summary>
        <div className="pt-4">
          <PriceCalculator selection={selection} onChange={setSelection} />
        </div>
      </details>
      <details className="mt-2 border-t border-espresso/10 pt-3">
        <summary className="cursor-pointer text-sm text-taupe py-2">
          Помощь с идеей · AI-помощник
        </summary>
        <p className="mt-3 text-sm text-taupe">
          Необязательный помощник. Окончательные параметры и цену подтверждает
          мастер.
        </p>
        <button
          type="button"
          disabled={aiLoading}
          onClick={askAi}
          className="mt-3 rounded-full border border-espresso/20 px-5 py-3 text-sm"
        >
          {aiLoading ? "Подбираем идеи…" : "Предложить идеи"}
        </button>
        {aiText && (
          <p
            role="status"
            className="mt-3 whitespace-pre-line text-sm text-espresso/75"
          >
            {aiText}
          </p>
        )}
      </details>
    </div>
  );
}
