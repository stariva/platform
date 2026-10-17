"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { ContactOptions } from "@/components/stariva/contact-master";
import {
  BULK_DISCOUNT,
  estimateOrder,
  itemsLeft,
  MAX_ORDER_ITEMS,
  ORDER_COLORS,
  ORDER_ITEM_TYPES,
  orderMessage,
  PLACE_TYPES,
  startingPrice,
} from "@/lib/b2b/order";
import { CONTACTS } from "@/lib/contacts";
import { formatRub } from "@/lib/custom-order/pricing";

const CHIP_CLASS =
  "rounded-full border border-espresso/20 px-3.5 py-2 text-sm text-espresso transition-colors hover:border-terracotta aria-pressed:border-terracotta aria-pressed:bg-terracotta aria-pressed:text-parchment";

const STEP_CLASS =
  "inline-flex size-10 items-center justify-center rounded-full border border-espresso/15 text-espresso transition-colors hover:border-espresso disabled:opacity-30 disabled:hover:border-espresso/15";

/**
 * Заказ для заведения: сколько каких изделий, цвет и место. Складывается
 * в готовое сообщение Ольге — заявка уходит через мессенджер.
 */
export function B2BOrder() {
  const [quantities, setQuantities] = useState<Record<string, number>>({
    lampshade: 3,
  });
  const [colorId, setColorId] = useState("natural");
  const [place, setPlace] = useState<string>();
  const [city, setCity] = useState("");

  const order = { quantities, colorId, place, city };
  const estimate = estimateOrder(order);
  const left = itemsLeft(order);
  const message = orderMessage(order);

  const change = (id: string, delta: number) =>
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) + delta),
    }));

  return (
    <section id="order" className="scroll-mt-24 py-28 lg:py-40">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
        <div className="mb-14 lg:mb-16 max-w-3xl">
          <p className="label-caps text-terracotta tracking-widest mb-4">
            Заказ
          </p>
          <h2 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-espresso leading-[1.05]">
            Посчитайте заказ
          </h2>
          <p className="mt-6 text-taupe text-base leading-[1.8] max-w-xl">
            Выберите, что и сколько нужно, — до {MAX_ORDER_ITEMS} изделий. Цена
            ориентировочная: точную назову, когда увижу фото места.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-12 items-start">
          <div className="flex flex-col gap-8 rounded-2xl border border-espresso/10 bg-white p-5 sm:p-8">
            <fieldset>
              <legend className="font-serif text-xl text-espresso mb-4">
                Изделия
              </legend>
              <ul className="flex flex-col divide-y divide-espresso/8 border-y border-espresso/8">
                {ORDER_ITEM_TYPES.map((type) => {
                  const quantity = quantities[type.id] ?? 0;
                  return (
                    <li
                      key={type.id}
                      className="grid grid-cols-[1fr_auto] items-center gap-4 py-4"
                    >
                      <div>
                        <p className="font-serif text-lg text-espresso">
                          {type.label}
                        </p>
                        <p className="text-sm text-taupe">
                          {type.hint} · {startingPrice(type)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => change(type.id, -1)}
                          disabled={quantity === 0}
                          aria-label={`Убрать: ${type.label}`}
                          className={STEP_CLASS}
                        >
                          <MinusIcon className="size-4" />
                        </button>
                        <output
                          aria-live="polite"
                          aria-label={`${type.label}, штук`}
                          className="w-8 text-center font-serif text-2xl text-espresso tabular-nums"
                        >
                          {quantity}
                        </output>
                        <button
                          type="button"
                          onClick={() => change(type.id, 1)}
                          disabled={left === 0}
                          aria-label={`Добавить: ${type.label}`}
                          className={STEP_CLASS}
                        >
                          <PlusIcon className="size-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {left === 0 && (
                <p className="mt-3 text-sm text-terracotta">
                  {MAX_ORDER_ITEMS} изделий — столько я успеваю сплести за один
                  заказ.
                </p>
              )}
            </fieldset>

            <fieldset>
              <legend className="font-serif text-xl text-espresso mb-4">
                Цвет
              </legend>
              <div className="flex flex-wrap gap-2">
                {ORDER_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    aria-pressed={colorId === color.id}
                    onClick={() => setColorId(color.id)}
                    className={CHIP_CLASS}
                  >
                    {color.label}
                    {color.value > 0 && ` +${Math.round(color.value * 100)}%`}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="font-serif text-xl text-espresso mb-4">
                Для какого места
              </legend>
              <div className="flex flex-wrap gap-2">
                {PLACE_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={place === type}
                    onClick={() => setPlace(place === type ? undefined : type)}
                    className={CHIP_CLASS}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <label className="mt-4 flex flex-col gap-1.5 text-sm text-espresso max-w-xs">
                Город — для доставки
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  maxLength={80}
                  placeholder="Москва"
                  className="w-full rounded-xl border border-espresso/15 bg-white px-3.5 py-2.5 text-[15px] text-espresso placeholder:text-taupe/70 focus-visible:outline-2 focus-visible:outline-espresso"
                />
              </label>
            </fieldset>
          </div>

          <div className="lg:sticky lg:top-24 rounded-2xl bg-espresso text-parchment p-5 sm:p-8">
            <p className="label-caps text-linen/60 tracking-widest">
              Ваш заказ
            </p>
            <dl className="mt-5 divide-y divide-parchment/10 border-y border-parchment/10">
              <div className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-parchment/70 text-sm">Изделий</dt>
                <dd className="font-serif text-2xl">
                  {estimate.items}
                  <span className="text-parchment/40 text-base">
                    {" "}
                    / {MAX_ORDER_ITEMS}
                  </span>
                </dd>
              </div>
              {estimate.max > 0 && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                  <dt className="text-sm">
                    Ориентир{" "}
                    {estimate.discountPercent > 0 && (
                      <span className="whitespace-nowrap rounded-full bg-terracotta px-2 py-0.5 text-[12px] text-parchment">
                        −{estimate.discountPercent}%
                      </span>
                    )}
                  </dt>
                  <dd className="ml-auto whitespace-nowrap font-serif text-2xl text-right">
                    {formatRub(estimate.discountedMin)}–
                    {formatRub(estimate.discountedMax)}
                  </dd>
                </div>
              )}
              {estimate.items > 0 && (
                <div className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-parchment/70 text-sm">Срок</dt>
                  <dd className="text-right">{estimate.leadTime}</dd>
                </div>
              )}
            </dl>
            <ul className="mt-4 space-y-1.5 text-[13px] leading-relaxed text-parchment/70">
              {estimate.items > 0 &&
                estimate.items < BULK_DISCOUNT.minItems && (
                  <li>
                    От {BULK_DISCOUNT.minItems} изделий — скидка{" "}
                    {BULK_DISCOUNT.percent}%.
                  </li>
                )}
              <li>Доставка СДЭК или Почтой — по тарифу, считается отдельно.</li>
            </ul>

            <div className="mt-6 rounded-2xl bg-parchment p-4 sm:p-5 text-espresso">
              <p className="font-serif text-xl">Отправить заказ Ольге</p>
              <p className="mt-1 text-[13px] text-taupe leading-relaxed">
                Список уже в сообщении. Следом пришлите фото места, где будут
                висеть изделия.
              </p>
              <ContactOptions source="b2b_order" message={message} />
              <p className="mt-4 text-xs leading-relaxed text-taupe">
                Отвечаю в рабочее время: {CONTACTS.hours}.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
