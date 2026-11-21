"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/catalog/types";
import {
  ELKA_KIT_OWNER_PRICE_KOPECKS,
  ELKA_KIT_SLUG,
} from "@/lib/commerce/elka-kit-price";
import type { ElkaKitVariant } from "@/lib/commerce/elka-kit-variants";
import { isPurchasable } from "@/lib/in-stock";
import { formatPrice, productHref } from "@/lib/products";
import { ElkaKitBuyButton } from "./elka-kit-buy-button";

function ownerPrice(product: Product): number {
  return Math.min(
    Math.round(product.price * 100),
    ELKA_KIT_OWNER_PRICE_KOPECKS,
  );
}

function isAvailable(product: Product): boolean {
  return isPurchasable(product) && product.stockAvailable > 0;
}

export function ElkaKitOffer({
  variants,
  compact = false,
}: {
  variants: ElkaKitVariant[];
  compact?: boolean;
}) {
  const firstAvailable = variants.find((variant) =>
    isAvailable(variant.product),
  );
  const preferred = variants.find(
    (variant) => variant.slug === ELKA_KIT_SLUG && isAvailable(variant.product),
  );
  const [selectedSlug, setSelectedSlug] = useState(
    (preferred ?? firstAvailable ?? variants[0])?.slug ?? "",
  );
  const selected =
    variants.find((variant) => variant.slug === selectedSlug) ??
    firstAvailable ??
    variants[0];

  if (!selected) return null;

  const { product } = selected;
  const price = ownerPrice(product);
  const available = isAvailable(product);
  const hasImage = Boolean(product.images[0]);

  return (
    <section
      aria-label="Набор для участниц мастер-класса по ёлке"
      className={
        compact
          ? "overflow-hidden rounded-2xl border border-terracotta/25 bg-white p-4"
          : "overflow-hidden rounded-2xl border border-terracotta/25 bg-white p-5 sm:p-6"
      }
    >
      <div
        className={
          hasImage
            ? "grid grid-cols-[80px_minmax(0,1fr)] gap-x-4 gap-y-4 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-x-6"
            : "grid gap-4"
        }
      >
        {product.images[0] ? (
          <div
            className={
              compact
                ? "relative size-20 shrink-0 overflow-hidden rounded-xl bg-sand"
                : "relative size-20 shrink-0 overflow-hidden rounded-xl bg-sand sm:size-32"
            }
          >
            <Image
              src={product.images[0]}
              alt={`Хлопковый шнур и деревянные детали набора для ёлки макраме, цвет ${selected.label.toLowerCase()}`}
              fill
              sizes={compact ? "80px" : "(min-width: 640px) 128px, 80px"}
              className="object-cover"
            />
          </div>
        ) : null}
        <div className="min-w-0 self-center">
          <p className="label-caps mb-1 text-[11px] text-terracotta">
            Специально для участниц
          </p>
          <h2 className="font-serif text-xl leading-snug text-espresso sm:text-2xl">
            Набор для вашей ёлки — {formatPrice(price / 100)}
          </h2>
          {variants.length > 1 ? (
            <fieldset className="mt-3">
              <legend className="sr-only">Цвет набора</legend>
              <div className="flex flex-wrap gap-2">
                {variants.map((variant) => {
                  const enabled = isAvailable(variant.product);
                  return (
                    <button
                      key={variant.slug}
                      type="button"
                      disabled={!enabled}
                      aria-pressed={variant.slug === selected.slug}
                      onClick={() => setSelectedSlug(variant.slug)}
                      className={`flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-sm text-espresso transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        variant.slug === selected.slug
                          ? "border-espresso bg-sand"
                          : "border-espresso/15 hover:border-espresso/40"
                      }`}
                    >
                      <span
                        className="size-4 shrink-0 rounded-full border border-espresso/15"
                        style={{ backgroundColor: variant.swatch }}
                        aria-hidden
                      />
                      {variant.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-sm text-taupe">{selected.hint}</p>
            </fieldset>
          ) : null}
        </div>
        <div className={hasImage ? "col-span-2 sm:col-start-2" : ""}>
          <p className="text-sm leading-relaxed text-dark-grey">
            Мастер-класс у вас уже есть — докупите только материалы: клубок
            хлопкового шнура (110–120 м, уже нарезан на отрезки), деревянную
            основу, бусины и звезду.
            {product.price * 100 > price
              ? ` Обычная цена набора — ${formatPrice(product.price)}.`
              : ""}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            {available ? (
              <ElkaKitBuyButton product={product} />
            ) : (
              <p className="text-sm text-taupe">
                Этого цвета сейчас нет в наличии
              </p>
            )}
            <Link
              href={productHref(product)}
              className="inline-flex min-h-11 items-center text-sm text-terracotta underline underline-offset-4 hover:text-terracotta-dark"
            >
              Что в наборе
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
