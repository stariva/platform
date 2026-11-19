"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart/cart-context";
import {
  type KitAccessMode,
  kitBundleTotal,
} from "@/lib/commerce/elka-kit-bundle";
import { CONTACTS } from "@/lib/contacts";
import { formatPrice } from "@/lib/products";

interface Variant {
  id: string;
  slug: string;
  label: string;
  hint: string;
  swatch: string;
  name: string;
  price: number;
  oldPrice?: number;
  images: string[];
  stock: number;
  ozonSku?: number;
}

function available(variant: Variant) {
  return variant.stock > 0 && Boolean(variant.ozonSku);
}

export function KitLanding({
  variants,
  catalogUnavailable,
  children,
}: {
  variants: Variant[];
  catalogUnavailable: boolean;
  children: ReactNode;
}) {
  const { clear, add, hydrated } = useCart();
  const router = useRouter();
  const first = variants.find(available);
  const minPrice = Math.min(
    ...variants.filter(available).map((item) => item.price),
  );
  const [heroSlug, setHeroSlug] = useState(variants[0]?.slug ?? "");
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const [slots, setSlots] = useState<string[]>(first ? [first.slug] : []);
  const [mode, setMode] = useState<KitAccessMode>("single_lesson");
  const [gift, setGift] = useState(false);
  const [orderVisible, setOrderVisible] = useState(false);
  const orderRef = useRef<HTMLElement>(null);
  const stockTotal = variants.reduce(
    (sum, item) => sum + (available(item) ? item.stock : 0),
    0,
  );
  const hero = variants.find((item) => item.slug === heroSlug) ?? variants[0];
  const count = slots.length || 1;
  const selected = slots.map((slug) =>
    variants.find((item) => item.slug === slug),
  );
  const total =
    count === 1
      ? (selected[0]?.price ?? first?.price ?? 0)
      : (kitBundleTotal(count, mode) ?? 0) / 100;
  const compare =
    count === 1
      ? (selected[0]?.oldPrice ?? selected[0]?.price ?? 0)
      : selected.reduce((sum, item) => sum + (item?.price ?? 0), 0);
  const saving = Math.max(compare - total, 0);
  const complete =
    selected.length === count &&
    selected.every((item) => item && available(item)) &&
    (count === 1 || compare >= total);

  useEffect(() => {
    const node = orderRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setOrderVisible(entry?.isIntersecting ?? false),
      { threshold: 0.08 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function scrollToOrder() {
    orderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showColor(slug: string) {
    setHeroSlug(slug);
    setHeroImageIndex(0);
  }

  function chooseCount(nextCount: number) {
    if (nextCount > stockTotal) return;
    const next = slots.slice(0, nextCount);
    while (next.length < nextCount) {
      const candidate = variants.find(
        (variant) =>
          available(variant) &&
          next.filter((slug) => slug === variant.slug).length < variant.stock,
      );
      if (!candidate) return;
      next.push(candidate.slug);
    }
    setSlots(next);
  }

  function chooseColor(index: number, slug: string) {
    const variant = variants.find((item) => item.slug === slug);
    if (
      !variant ||
      !available(variant) ||
      slots.filter((item, slot) => slot !== index && item === slug).length >=
        variant.stock
    )
      return;
    setSlots((current) =>
      current.map((item, slot) => (slot === index ? slug : item)),
    );
    if (index === 0) showColor(slug);
  }

  function chooseCard(slug: string) {
    const variant = variants.find((item) => item.slug === slug);
    if (!variant || !available(variant)) return;
    const next = [slug, ...slots.slice(1)];
    for (let i = 1; i < next.length; i++) {
      const current = variants.find((item) => item.slug === next[i]);
      if (
        !current ||
        next.slice(0, i + 1).filter((value) => value === current.slug).length >
          current.stock
      ) {
        next[i] =
          variants.find(
            (item) =>
              available(item) &&
              next.slice(0, i).filter((value) => value === item.slug).length <
                item.stock,
          )?.slug ?? "";
      }
    }
    setSlots(next);
    showColor(slug);
    scrollToOrder();
  }

  function checkout() {
    if (!hydrated || !complete) return;
    clear("stock");
    for (const variant of variants) {
      const quantity = slots.filter((slug) => slug === variant.slug).length;
      if (!quantity || !variant.ozonSku) continue;
      add(
        {
          productId: variant.id,
          productSlug: variant.slug,
          ozonSku: variant.ozonSku,
          name: variant.name,
          image: variant.images[0] ?? "",
          price: Math.round(variant.price * 100),
          fulfillmentType: "stock",
          kit: true,
        },
        quantity,
      );
    }
    const params = new URLSearchParams();
    if (count > 1) params.set("kitAccessMode", mode);
    if (count === 1 && gift) params.set("kitGift", "1");
    router.push(`/checkout${params.size ? `?${params}` : ""}`);
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-espresso/10 bg-parchment/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <a href="#top" className="font-serif text-2xl text-espresso">
            Stariva
          </a>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={scrollToOrder}
              className="rounded-full bg-espresso px-4 py-2.5 text-sm text-parchment"
            >
              Выбрать цвет
            </button>
            <a
              href={CONTACTS.telegramUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Задать вопрос в Telegram"
              className="rounded-full border border-espresso/20 px-3 py-2.5 text-sm text-espresso"
            >
              Telegram
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="bg-parchment px-5 py-12 lg:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="label-caps mb-5 text-terracotta">
                Набор для творчества с видеоуроком ·{" "}
                {stockTotal > 0 ? "В наличии" : "Сейчас нет в наличии"}
              </p>
              <h1 className="font-serif text-[clamp(2.7rem,5vw,5rem)] leading-[1.04] text-espresso">
                Сплетите настенную ёлку макраме за два уютных вечера
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-dark-grey">
                В коробке всё готово: 100 м хлопкового шнура, основа, декор,
                подробный видеоурок и чат с мастером. Три природных оттенка под
                любой интерьер.
              </p>
              <div className="mt-7 flex items-baseline gap-4">
                <span className="font-serif text-4xl text-espresso">
                  {hero ? formatPrice(hero.price) : "—"}
                </span>
                {hero?.oldPrice && (
                  <s className="text-lg text-taupe">
                    {formatPrice(hero.oldPrice)}
                  </s>
                )}
              </div>
              <button
                type="button"
                onClick={scrollToOrder}
                className="mt-7 min-h-12 rounded-full bg-espresso px-8 py-3 text-parchment hover:bg-espresso/85"
              >
                Выбрать цвет и заказать
              </button>
              <p className="mt-4 text-sm text-taupe">
                Отправим через Ozon за 1–2 дня · Доступ к уроку навсегда
              </p>
            </div>
            <div>
              <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-sand">
                {hero?.images[heroImageIndex] ? (
                  <Image
                    src={hero.images[heroImageIndex]}
                    alt={hero.name}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <Image
                    src="/images/elka/hero.png"
                    alt="Пример настенной ёлки макраме"
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                )}
              </div>
              {hero && hero.images.length > 1 && (
                <fieldset className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  <legend className="sr-only">
                    Фотографии выбранного цвета
                  </legend>
                  {hero.images.map((src, index) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setHeroImageIndex(index)}
                      aria-label={`Фото ${index + 1}: ${hero.label}`}
                      aria-pressed={heroImageIndex === index}
                      className={`relative size-16 shrink-0 overflow-hidden rounded-xl border-2 ${heroImageIndex === index ? "border-espresso" : "border-transparent"}`}
                    >
                      <Image
                        src={src}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </button>
                  ))}
                </fieldset>
              )}
              <fieldset
                className="mt-4 flex flex-wrap justify-center gap-3"
                aria-label="Посмотреть цвет"
              >
                {variants.map((variant) => (
                  <button
                    key={variant.slug}
                    type="button"
                    onClick={() => showColor(variant.slug)}
                    aria-pressed={heroSlug === variant.slug}
                    className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm text-espresso ${heroSlug === variant.slug ? "border-espresso" : "border-espresso/15"}`}
                  >
                    <span
                      className="size-5 rounded-full border border-espresso/15"
                      style={{ backgroundColor: variant.swatch }}
                    />
                    {variant.label}
                  </button>
                ))}
              </fieldset>
            </div>
          </div>
        </section>

        <section
          className="bg-parchment px-5 pb-16 lg:pb-24"
          aria-labelledby="colors-title"
        >
          <div className="mx-auto max-w-6xl">
            <p className="label-caps mb-3 text-terracotta">
              Три природных оттенка
            </p>
            <h2
              id="colors-title"
              className="font-serif text-4xl text-espresso md:text-5xl"
            >
              Выберите свой оттенок
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {variants.map((variant) => (
                <article
                  key={variant.slug}
                  className="overflow-hidden rounded-3xl border border-espresso/10 bg-sand"
                >
                  <div className="relative aspect-[4/5] bg-parchment">
                    {variant.images[0] && (
                      <Image
                        src={variant.images[0]}
                        alt={variant.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-serif text-3xl text-espresso">
                      {variant.label}
                    </h3>
                    <p className="mt-2 min-h-14 text-sm leading-relaxed text-dark-grey">
                      {variant.hint}
                    </p>
                    <p className="mt-4 text-sm text-espresso">
                      {available(variant)
                        ? `В наличии · ${variant.stock} шт.`
                        : "Нет в наличии"}
                    </p>
                    <button
                      type="button"
                      disabled={!available(variant)}
                      onClick={() => chooseCard(variant.slug)}
                      className="mt-4 min-h-11 w-full rounded-full border border-espresso px-5 py-2.5 text-sm text-espresso transition hover:bg-espresso hover:text-parchment disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Выбрать {variant.label.toLowerCase()}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {variants.length < 3 && (
              <p className="mt-5 text-sm text-taupe">
                Некоторые оттенки пока не представлены в каталоге.
              </p>
            )}
          </div>
        </section>
      </main>

      {children}

      <section
        id="order"
        ref={orderRef}
        className="scroll-mt-20 bg-sand px-5 py-16 lg:py-24"
        aria-labelledby="order-title"
      >
        <div className="mx-auto max-w-3xl">
          <p className="label-caps mb-3 text-terracotta">
            Соберите свой комплект
          </p>
          <h2
            id="order-title"
            className="font-serif text-4xl text-espresso md:text-5xl"
          >
            Выберите наборы для себя или в подарок
          </h2>
          {catalogUnavailable && (
            <p
              role="status"
              className="mt-6 rounded-xl bg-parchment p-4 text-espresso"
            >
              Каталог временно недоступен. Напишите Ольге в Telegram, чтобы
              уточнить наличие.
            </p>
          )}
          <div className="mt-9 space-y-8 rounded-3xl bg-parchment p-5 md:p-8">
            <fieldset>
              <legend className="mb-4 font-medium text-espresso">
                1. Сколько наборов?
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={stockTotal < value}
                    aria-pressed={count === value}
                    onClick={() => chooseCount(value)}
                    className={`min-h-16 rounded-2xl border px-2 py-3 text-sm text-espresso disabled:cursor-not-allowed disabled:opacity-40 ${count === value ? "border-espresso bg-sand" : "border-espresso/15"}`}
                  >
                    <span className="block font-medium">
                      {value} {value === 1 ? "набор" : "набора"}
                    </span>
                    {value > 1 && (
                      <span className="block text-xs text-terracotta">
                        {value === 2 ? "Выгоднее" : "Макс. выгода"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </fieldset>
            {count > 1 && (
              <fieldset>
                <legend className="mb-4 font-medium text-espresso">
                  2. Как устроить доступ к уроку?
                </legend>
                <div className="grid gap-3">
                  {(["single_lesson", "separate_gifts"] as const).map(
                    (value) => (
                      <label
                        key={value}
                        className={`flex cursor-pointer gap-3 rounded-2xl border p-4 ${mode === value ? "border-espresso bg-sand" : "border-espresso/15"}`}
                      >
                        <input
                          type="radio"
                          name="accessMode"
                          value={value}
                          checked={mode === value}
                          onChange={() => setMode(value)}
                          className="mt-1 accent-espresso"
                        />
                        <span className="flex-1">
                          <strong className="block text-espresso">
                            {value === "single_lesson"
                              ? "Плету сама (1 видеоурок)"
                              : "В подарок разным людям (урок в каждой коробке)"}
                          </strong>
                          <span className="mt-1 block text-sm text-dark-grey">
                            {value === "single_lesson"
                              ? "Не переплачиваете за повторный урок. Материалы соберём в одну посылку."
                              : "Отдельные подарочные коробки, в каждой свой QR-код к уроку и чату."}
                          </span>
                        </span>
                        <span className="whitespace-nowrap font-medium text-espresso">
                          {formatPrice(
                            (kitBundleTotal(count, value) ?? 0) / 100,
                          )}
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </fieldset>
            )}
            <fieldset>
              <legend className="mb-4 font-medium text-espresso">
                {count > 1 ? "3." : "2."} Выберите цвета
              </legend>
              <div className="space-y-4">
                {slots.map((slug, index) => (
                  <div
                    key={["first", "second", "third"][index]}
                    className="rounded-2xl border border-espresso/10 p-4"
                  >
                    <p className="mb-3 text-sm text-espresso">
                      Набор {index + 1}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {variants.map((variant) => {
                        const used = slots.filter(
                          (item, slot) =>
                            slot !== index && item === variant.slug,
                        ).length;
                        const disabled =
                          !available(variant) || used >= variant.stock;
                        return (
                          <button
                            key={variant.slug}
                            type="button"
                            disabled={disabled}
                            title={
                              disabled
                                ? "Нет свободного остатка"
                                : variant.label
                            }
                            aria-pressed={slug === variant.slug}
                            onClick={() => chooseColor(index, variant.slug)}
                            className={`flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-sm text-espresso disabled:cursor-not-allowed disabled:opacity-40 ${slug === variant.slug ? "border-espresso bg-sand" : "border-espresso/15"}`}
                          >
                            <span
                              className="size-5 rounded-full border border-espresso/15"
                              style={{ backgroundColor: variant.swatch }}
                            />
                            {variant.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
            {count === 1 && (
              <label className="flex items-start gap-3 rounded-2xl bg-sand p-4 text-sm text-espresso">
                <input
                  type="checkbox"
                  checked={gift}
                  onChange={(event) => setGift(event.target.checked)}
                  className="mt-1 accent-espresso"
                />
                <span>
                  <strong className="block">Беру в подарок</strong>Не отправлять
                  ссылку на урок на мой email — доступ откроется по личному
                  QR-коду из коробки.
                </span>
              </label>
            )}
            {count > 1 && mode === "separate_gifts" && (
              <p className="rounded-2xl bg-sand p-4 text-sm text-espresso">
                Ссылки на email не отправляем — каждый получатель откроет урок
                по QR-коду из своей коробки.
              </p>
            )}
            <div className="border-t border-espresso/10 pt-6">
              <div className="flex items-baseline justify-between gap-3 text-espresso">
                <span>Итого за наборы</span>
                <strong className="font-serif text-4xl">
                  {total ? formatPrice(total) : "—"}
                </strong>
              </div>
              {saving > 0 && (
                <p className="mt-2 text-sm text-terracotta">
                  Экономия {formatPrice(saving)}
                </p>
              )}
              <button
                type="button"
                disabled={!hydrated || !complete}
                onClick={checkout}
                className="mt-6 min-h-14 w-full rounded-full bg-espresso px-6 py-3 text-parchment transition hover:bg-espresso/85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Оформить заказ
              </button>
              <p className="mt-3 text-center text-xs text-taupe">
                Стоимость доставки рассчитаем на следующем шаге.
              </p>
            </div>
          </div>
        </div>
      </section>
      {!orderVisible && stockTotal > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-espresso/10 bg-parchment px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg md:hidden">
          <span className="whitespace-nowrap font-serif text-xl text-espresso">
            от {formatPrice(minPrice)}
          </span>
          <button
            type="button"
            onClick={scrollToOrder}
            className="min-h-11 rounded-full bg-espresso px-5 text-sm text-parchment"
          >
            Выбрать цвет
          </button>
        </div>
      )}
    </>
  );
}
