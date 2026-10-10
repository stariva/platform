import { Check } from "lucide-react";
import Image from "next/image";
import { AddToCartButton } from "@/components/stariva/add-to-cart-button";
import { isPurchasable } from "@/lib/in-stock";
import type { Product } from "@/lib/ozon-types";
import { formatPrice } from "@/lib/workshops-data";
import type { TreeModel } from "../_data";
import { TrackedLink } from "./tracked-link";

export interface ModelWithProduct {
  model: TreeModel;
  product?: Product;
}

export function ElkaModels({ items }: { items: ModelWithProduct[] }) {
  return (
    <section
      id="models"
      aria-labelledby="models-title"
      className="bg-white scroll-mt-24"
    >
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 py-16 lg:py-24">
        <div className="max-w-2xl mb-12">
          <p className="label-caps text-terracotta text-[11px] mb-4">
            Две модели
          </p>
          <h2
            id="models-title"
            className="font-serif text-espresso leading-tight text-balance mb-4"
            style={{ fontSize: "clamp(30px, 4vw, 48px)" }}
          >
            Выберите ёлку для своей стены
          </h2>
          <p className="text-dark-grey leading-relaxed">
            Каждая ёлка плетётся вручную из мягкого хлопкового шнура на
            деревянной основе.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-10">
          {items.map(({ model, product }) => {
            const price = product?.price ?? model.fallbackPrice;
            const oldPrice = product?.oldPrice ?? model.fallbackOldPrice;
            const image = product?.images[0] ?? model.fallbackImage;
            const ready = product ? isPurchasable(product) : false;
            const discount =
              oldPrice && oldPrice > price
                ? Math.round((1 - price / oldPrice) * 100)
                : null;

            return (
              <article
                key={model.slug}
                className="flex flex-col rounded-[28px] bg-parchment overflow-hidden"
              >
                <div className="relative aspect-[4/5] bg-linen">
                  <Image
                    src={image}
                    alt={`${model.name}, ${model.size}`}
                    fill
                    sizes="(min-width: 768px) 45vw, 100vw"
                    className="object-cover"
                  />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className="rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-xs text-espresso">
                      {ready ? "В наличии" : "Под заказ 2–3 дня"}
                    </span>
                    {discount ? (
                      <span className="rounded-full bg-terracotta px-3 py-1.5 text-xs text-parchment">
                        −{discount}%
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col flex-1 p-6 lg:p-8">
                  <h3 className="font-serif text-2xl text-espresso mb-2">
                    {model.name}
                  </h3>
                  <p className="text-sm text-text-grey mb-5">
                    {model.size} · {model.color}
                  </p>

                  <p className="text-sm text-espresso mb-3">
                    <span className="text-text-grey">Лучше всего для: </span>
                    {model.bestFor}
                  </p>
                  <ul className="flex flex-col gap-2 mb-6">
                    {model.highlights.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-sm text-dark-grey"
                      >
                        <Check
                          className="size-4 text-sage mt-0.5 shrink-0"
                          aria-hidden
                        />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto">
                    <p className="flex items-baseline gap-3 mb-5">
                      <span className="font-serif text-3xl text-espresso">
                        {formatPrice(price)}
                      </span>
                      {oldPrice && oldPrice > price ? (
                        <s className="text-text-grey">
                          {formatPrice(oldPrice)}
                        </s>
                      ) : null}
                    </p>
                    <div className="flex flex-col gap-3">
                      {product && ready ? (
                        <AddToCartButton product={product} />
                      ) : null}
                      <TrackedLink
                        href={model.href}
                        goal="elka_model_click"
                        goalParams={{ slug: model.slug }}
                        className={
                          product && ready
                            ? "inline-flex items-center justify-center rounded-2xl border border-espresso/20 hover:border-espresso text-espresso py-4 transition-colors"
                            : "inline-flex items-center justify-center rounded-2xl bg-espresso hover:bg-terracotta text-parchment py-4 transition-colors"
                        }
                      >
                        {product && ready
                          ? "Подробнее о модели"
                          : "Заказать ёлку"}
                      </TrackedLink>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
