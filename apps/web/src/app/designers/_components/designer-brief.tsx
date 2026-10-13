"use client";

import { MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { useId, useState } from "react";
import { ContactOptions } from "@/components/stariva/contact-master";
import { CONTACTS } from "@/lib/contacts";
import { COLORS, formatRub, SIZES } from "@/lib/custom-order/pricing";
import {
  BRIEF_ITEM_TYPES,
  type BriefItem,
  briefMessage,
  estimateBrief,
  INDIVIDUAL_PRICE_FROM,
  MAX_ITEM_QUANTITY,
  OBJECT_TYPES,
  PROJECT_STAGES,
} from "@/lib/designers/brief";

const MAX_ITEMS = 12;

const inputClass =
  "w-full rounded-xl border border-espresso/15 bg-white px-3.5 py-2.5 text-[15px] text-espresso placeholder:text-taupe/70 focus-visible:outline-2 focus-visible:outline-espresso";

const chipClass =
  "rounded-full border border-espresso/20 px-3.5 py-2 text-sm text-espresso transition-colors hover:border-terracotta aria-pressed:border-terracotta aria-pressed:bg-terracotta aria-pressed:text-parchment";

/**
 * Бриф проекта для дизайнера: позиции, объект и сроки складываются в готовое
 * сообщение Ольге, а ориентир по модели цен показывает выгоду скидки.
 * Заявка уходит через мессенджер — как и остальные обращения на сайте.
 */
export function DesignerBrief() {
  const id = useId();
  const [items, setItems] = useState<BriefItem[]>([
    { typeId: "lampshade", sizeId: "m", quantity: 4 },
  ]);
  const [colorId, setColorId] = useState("natural");
  const [objectType, setObjectType] = useState<string>();
  const [stage, setStage] = useState<string>();
  const [author, setAuthor] = useState("");
  const [city, setCity] = useState("");
  const [deadline, setDeadline] = useState("");
  const [comment, setComment] = useState("");

  const brief = {
    author,
    objectType,
    stage,
    city,
    colorId,
    deadline,
    comment,
    items,
  };
  const estimate = estimateBrief(brief);
  const message = briefMessage(brief);

  const updateItem = (index: number, patch: Partial<BriefItem>) =>
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  const setQuantity = (index: number, quantity: number) =>
    updateItem(index, {
      quantity: Math.min(MAX_ITEM_QUANTITY, Math.max(1, quantity || 1)),
    });

  return (
    <section id="brief" className="scroll-mt-24 py-28 lg:py-40 bg-sand">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
        <div className="mb-14 lg:mb-16 max-w-3xl">
          <p className="label-caps text-terracotta tracking-widest mb-4">
            Бриф проекта
          </p>
          <h2 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-espresso leading-[1.05]">
            Соберите заявку
            <br />
            <span className="text-taupe">за пару минут</span>
          </h2>
          <p className="mt-6 text-taupe text-base leading-[1.8] max-w-xl">
            Отметьте позиции и сроки — бриф превратится в готовое сообщение
            Ольге. Ориентир по стоимости увидите сразу, точный расчёт придёт в
            КП.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-12 items-start">
          {/* ── Form ─────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-8 rounded-2xl border border-espresso/10 bg-parchment p-5 sm:p-8">
            <fieldset>
              <legend className="font-serif text-xl text-espresso mb-4">
                Позиции
              </legend>
              <ul className="flex flex-col gap-3">
                {items.map((item, index) => (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity besides their position
                    key={index}
                    className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.3fr_1fr_auto_auto] items-center gap-2 rounded-xl border border-espresso/10 bg-white p-3"
                  >
                    <label className="sr-only" htmlFor={`${id}-type-${index}`}>
                      Изделие {index + 1}
                    </label>
                    <select
                      id={`${id}-type-${index}`}
                      value={item.typeId}
                      onChange={(e) =>
                        updateItem(index, { typeId: e.target.value })
                      }
                      className={inputClass}
                    >
                      {BRIEF_ITEM_TYPES.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setItems((prev) => prev.filter((_, i) => i !== index))
                      }
                      disabled={items.length === 1}
                      aria-label={`Удалить позицию ${index + 1}`}
                      className="sm:order-last inline-flex size-10 items-center justify-center rounded-full text-espresso/50 hover:bg-sand hover:text-espresso transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <XIcon className="size-4" />
                    </button>
                    <label className="sr-only" htmlFor={`${id}-size-${index}`}>
                      Размер позиции {index + 1}
                    </label>
                    <select
                      id={`${id}-size-${index}`}
                      value={item.sizeId}
                      onChange={(e) =>
                        updateItem(index, { sizeId: e.target.value })
                      }
                      className={inputClass}
                    >
                      {SIZES.map((size) => (
                        <option key={size.id} value={size.id}>
                          {size.hint}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setQuantity(index, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        aria-label={`Меньше, позиция ${index + 1}`}
                        className="inline-flex size-9 items-center justify-center rounded-full border border-espresso/15 text-espresso hover:border-espresso/40 disabled:opacity-30"
                      >
                        <MinusIcon className="size-3.5" />
                      </button>
                      <label className="sr-only" htmlFor={`${id}-qty-${index}`}>
                        Количество, позиция {index + 1}
                      </label>
                      <input
                        id={`${id}-qty-${index}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_ITEM_QUANTITY}
                        value={item.quantity}
                        onChange={(e) =>
                          setQuantity(index, Number(e.target.value))
                        }
                        className="w-14 rounded-lg border border-espresso/15 bg-white py-2 text-center text-[15px] text-espresso [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity(index, item.quantity + 1)}
                        disabled={item.quantity >= MAX_ITEM_QUANTITY}
                        aria-label={`Больше, позиция ${index + 1}`}
                        className="inline-flex size-9 items-center justify-center rounded-full border border-espresso/15 text-espresso hover:border-espresso/40 disabled:opacity-30"
                      >
                        <PlusIcon className="size-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {items.length < MAX_ITEMS && (
                <button
                  type="button"
                  onClick={() =>
                    setItems((prev) => [
                      ...prev,
                      { typeId: "panel", sizeId: "m", quantity: 1 },
                    ])
                  }
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-dashed border-espresso/30 px-4 py-2.5 text-sm text-espresso hover:border-espresso transition-colors"
                >
                  <PlusIcon className="size-4" />
                  Добавить позицию
                </button>
              )}
            </fieldset>

            <fieldset>
              <legend className="font-serif text-xl text-espresso mb-4">
                Цвет
              </legend>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    aria-pressed={colorId === color.id}
                    onClick={() => setColorId(color.id)}
                    className={chipClass}
                  >
                    {color.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="font-serif text-xl text-espresso mb-4">
                Объект{" "}
                <span className="text-sm text-taupe font-sans">
                  · можно не выбирать
                </span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {OBJECT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={objectType === type}
                    onClick={() =>
                      setObjectType(objectType === type ? undefined : type)
                    }
                    className={chipClass}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="font-serif text-xl text-espresso mb-4">
                Стадия проекта
              </legend>
              <div className="flex flex-wrap gap-2">
                {PROJECT_STAGES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={stage === item}
                    onClick={() => setStage(stage === item ? undefined : item)}
                    className={chipClass}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 text-sm text-espresso">
                Студия или имя
                <input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  maxLength={120}
                  autoComplete="organization"
                  placeholder="Например, студия «Север»"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm text-espresso">
                Город объекта
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  maxLength={80}
                  placeholder="Москва"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm text-espresso sm:col-span-2">
                Нужно к дате
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm text-espresso sm:col-span-2">
                Комментарий
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Стиль, палитра, высота потолков, требования объекта"
                  className={`${inputClass} resize-y`}
                />
              </label>
            </div>
          </div>

          {/* ── Summary ──────────────────────────────────────────────────── */}
          <div className="lg:sticky lg:top-24 rounded-2xl bg-espresso text-parchment p-5 sm:p-8">
            <p className="label-caps text-linen/60 tracking-widest">
              Ориентир по проекту
            </p>
            <dl className="mt-5 divide-y divide-parchment/10 border-y border-parchment/10">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                <dt className="text-parchment/70 text-sm">Изделий</dt>
                <dd className="font-serif text-2xl">{estimate.items}</dd>
              </div>
              {estimate.max > 0 && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                  <dt className="text-parchment/70 text-sm">Без скидки</dt>
                  <dd className="ml-auto whitespace-nowrap text-parchment/70 text-right line-through decoration-parchment/40">
                    {formatRub(estimate.min)}–{formatRub(estimate.max)}
                  </dd>
                </div>
              )}
              {estimate.max > 0 && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                  <dt className="text-sm">
                    Со скидкой дизайнера{" "}
                    <span className="whitespace-nowrap rounded-full bg-terracotta px-2 py-0.5 text-[12px] text-parchment">
                      −{estimate.discountPercent}%
                    </span>
                  </dt>
                  <dd className="ml-auto whitespace-nowrap font-serif text-2xl text-right">
                    {formatRub(estimate.discountedMin)}–
                    {formatRub(estimate.discountedMax)}
                  </dd>
                </div>
              )}
            </dl>
            <ul className="mt-4 space-y-1.5 text-[13px] leading-relaxed text-parchment/70">
              {estimate.unpriced > 0 && (
                <li>
                  Перегородки, логотипы и другие позиции по эскизу в ориентир не
                  входят — посчитаем их в КП.
                </li>
              )}
              {estimate.items >= INDIVIDUAL_PRICE_FROM && (
                <li>
                  От {INDIVIDUAL_PRICE_FROM} изделий цену считаем индивидуально
                  — итог может быть ниже.
                </li>
              )}
              <li>
                Ориентир по модели цен сайта при стандартной плотности плетения.
                Доставка и монтаж — отдельно.
              </li>
            </ul>

            <div className="mt-6 rounded-2xl bg-parchment p-4 sm:p-5 text-espresso">
              <p className="font-serif text-xl">Отправить бриф Ольге</p>
              <p className="mt-1 text-[13px] text-taupe leading-relaxed">
                После отправки приложите в чат план, развёртки или визуализации.
              </p>
              <ContactOptions source="designers_brief" message={message} />
              <p className="mt-4 text-xs leading-relaxed text-taupe">
                Отвечаем в рабочее время: {CONTACTS.hours}.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
