"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { reachGoal } from "@/lib/analytics";
import { PRODUCT_TYPES } from "@/lib/custom-order/pricing";
import { validatePhoto } from "@/lib/custom-order/schema";
import {
  ConsentCheckbox,
  PD_CONSENT_ERROR,
  PersonalDataConsentLabel,
} from "./consent-checkbox";
import { ContactMasterButton } from "./contact-master";
import { useHomeOrder } from "./home-order-context";

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
  personalDataConsent: z.boolean().refine(Boolean, PD_CONSENT_ERROR),
});
type Values = z.infer<typeof schema>;
const defaults: Values = {
  contact: "",
  description: "",
  personalDataConsent: false,
};
const fieldClass =
  "mt-2 block w-full rounded-xl border border-espresso/20 bg-parchment px-4 py-3 text-base text-espresso placeholder:text-taupe focus:outline-none focus:ring-2 focus:ring-terracotta/40 disabled:opacity-60";
const tips: Record<string, { example: string; mention: string }> = {
  lampshade: {
    example:
      "Например: абажур на кухню над столом, диаметр около 40 см, светлый, плотное плетение.",
    mention: "диаметр и высоту, цвет, куда повесите и тип крепления",
  },
  clothes: {
    example:
      "Например: молочная туника для отпуска, длина до колена. Нужна помощь с мерками.",
    mention: "что за вещь, цвет, длину, рост и обхваты, если знаете",
  },
  bag: {
    example: "Например: авоська для рынка, бежевая, ручки на плечо.",
    mention: "размеры, цвет, длину ручек или ремня",
  },
  panel: {
    example:
      "Например: панно над кроватью, примерно 80 × 100 см, натуральный цвет, с бахромой.",
    mention: "ширину и высоту, цвет, нужна ли бахрома",
  },
  tipi: {
    example:
      "Например: подвесное кресло на балкон, крепление в потолок уже есть.",
    mention: "что именно нужно, размеры и где будет стоять или висеть",
  },
  "plant-hanger": {
    example: "Например: два подвеса для горшков диаметром 15 см, длина 1 м.",
    mention: "диаметр горшка, длину подвеса и количество",
  },
  placemat: {
    example: "Например: 6 круглых подставок под тарелки, диаметр 35 см.",
    mention: "размер, форму и сколько штук нужно",
  },
};
const defaultTip = {
  example:
    "Расскажите своими словами: что за изделие, для какого места, какой цвет и размер.",
  mention: "что за изделие, размер, цвет и для какого места",
};

export function CustomOrderForm() {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const started = useRef(false);
  const locked = useRef(false);
  const { productType, setProductType } = useHomeOrder();
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const tip = tips[productType ?? ""] ?? defaultTip;
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
      const productLabel = PRODUCT_TYPES.find(
        (item) => item.id === productType,
      )?.label;
      if (productLabel) fd.append("productType", productLabel);
      if (photo) fd.append("photo", photo);
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
        <ContactMasterButton
          source="custom_order_success"
          message={`Здравствуйте, Ольга! Хочу добавить детали к заявке ${success}.`}
          className="mt-5 inline-block text-terracotta underline underline-offset-4"
        >
          Добавить детали в мессенджере
        </ContactMasterButton>
        <button
          type="button"
          onClick={() => {
            setSuccess("");
            request.current = null;
            started.current = false;
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
          <legend className="font-serif text-2xl text-espresso mb-2!">
            Получить расчёт от мастера
          </legend>
          <p className="text-sm text-espresso/75 leading-relaxed">
            Напишите своими словами, что хотите. Ольга уточнит детали и
            посчитает стоимость.
          </p>
          <fieldset>
            <legend className="text-sm text-espresso">
              Что будем создавать?{" "}
              <span className="text-taupe">· можно не выбирать</span>
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRODUCT_TYPES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={productType === item.id}
                  onClick={() =>
                    setProductType(
                      productType === item.id ? undefined : item.id,
                    )
                  }
                  className="rounded-full border border-espresso/20 px-3.5 py-2 text-sm text-espresso transition-colors hover:border-terracotta aria-pressed:border-terracotta aria-pressed:bg-terracotta aria-pressed:text-parchment"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label
            htmlFor={`${id}-description`}
            className="block text-sm text-espresso"
          >
            Ваша идея
            <textarea
              id={`${id}-description`}
              {...form.register("description")}
              maxLength={3000}
              rows={5}
              placeholder={tip.example}
              className={fieldClass}
              aria-invalid={!!form.formState.errors.description}
              aria-describedby={`${id}-description-tip ${id}-description-error`}
            />
            <span
              id={`${id}-description-tip`}
              className="mt-2 block text-xs leading-relaxed text-taupe"
            >
              Полезно указать: {tip.mention}. Не знаете размеры или бюджет — так
              и напишите, поможем.
            </span>
            <span
              id={`${id}-description-error`}
              className="text-red-700 text-sm"
            >
              {form.formState.errors.description?.message}
            </span>
          </label>
          <label htmlFor={`${id}-photo`} className="block text-sm">
            Фото для примера или места, где будет изделие{" "}
            <span className="text-taupe">· необязательно</span>
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
              JPG, PNG или WebP, до 8 МБ. Больше фото можно прислать в Telegram.
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
              <ContactMasterButton
                source="custom_order_error"
                className="underline"
              >
                Написать мастеру
              </ContactMasterButton>
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
            Удобнее в переписке —{" "}
            <ContactMasterButton
              source="custom_order_form"
              className="underline underline-offset-4"
            >
              напишите в мессенджер
            </ContactMasterButton>
            .
          </p>
        </fieldset>
      </form>
    </div>
  );
}
