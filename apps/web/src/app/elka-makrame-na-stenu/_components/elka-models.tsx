import { Check } from "lucide-react";
import Image from "next/image";
import { AddToCartButton } from "@/components/stariva/add-to-cart-button";
import { TrackedLink } from "@/components/stariva/tracked-link";
import type { Product } from "@/lib/catalog/types";
import { treeDetails } from "@/lib/elka/data";
import { isPurchasable } from "@/lib/in-stock";
import { madeToOrderLeadTime } from "@/lib/made-to-order";
import { productHref } from "@/lib/products";
import { formatPrice } from "@/lib/workshops-data";
import { TREES_MODELS_ID } from "../_data";

type TreeState = "inStock" | "madeToOrder" | "unavailable";

/** Плашка и кнопка карточки по состоянию ёлки. */
const STATE_COPY: Record<
  TreeState,
  { badge: (tree: Product) => string; cta: string }
> = {
  inStock: { badge: () => "В наличии", cta: "Подробнее о модели" },
  madeToOrder: {
    badge: (tree) => `Под заказ ${madeToOrderLeadTime(tree)}`,
    cta: "Заказать ёлку",
  },
  unavailable: { badge: () => "Нет в наличии", cta: "Подробнее о модели" },
};

function treeState(tree: Product): TreeState {
  if (isPurchasable(tree)) return "inStock";
  return tree.madeToOrder ? "madeToOrder" : "unavailable";
}

export function ElkaModels({
  trees,
  unavailable,
}: {
  trees: Product[];
  /** База недоступна — в отличие от «ёлок в каталоге нет». */
  unavailable: boolean;
}) {
  return (
    <section
      id={TREES_MODELS_ID}
      aria-labelledby="models-title"
      className="bg-white scroll-mt-24"
    >
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 py-16 lg:py-24">
        <div className="max-w-2xl mb-12">
          <p className="label-caps text-terracotta text-[11px] mb-4">
            Готовые ёлки
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

        {trees.length === 0 ? (
          <p className="text-dark-grey">
            {unavailable
              ? "Каталог временно недоступен."
              : "Готовых ёлок сейчас нет в каталоге."}{" "}
            Напишите Ольге — она подскажет цену и сроки.
          </p>
        ) : null}

        <div className="grid md:grid-cols-2 gap-6 lg:gap-10">
          {trees.map((product) => {
            const { price, oldPrice } = product;
            const details = treeDetails(product);
            const image = product.images[0];
            const href = productHref(product);
            const state = treeState(product);
            const copy = STATE_COPY[state];
            const discount =
              oldPrice && oldPrice > price
                ? Math.round((1 - price / oldPrice) * 100)
                : null;

            return (
              <article
                key={product.id}
                className="flex flex-col rounded-[28px] bg-parchment overflow-hidden"
              >
                <div className="relative aspect-[4/5] bg-linen">
                  {image ? (
                    <Image
                      src={image}
                      alt={product.name}
                      fill
                      sizes="(min-width: 768px) 45vw, 100vw"
                      className="object-cover"
                    />
                  ) : null}
                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className="rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-xs text-espresso">
                      {copy.badge(product)}
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
                    {product.name}
                  </h3>
                  {details ? (
                    <p className="text-sm text-text-grey mb-5">{details}</p>
                  ) : null}
                  {product.bestFor ? (
                    <p className="text-sm text-espresso mb-3">
                      <span className="text-text-grey">Лучше всего для: </span>
                      {product.bestFor}
                    </p>
                  ) : null}
                  {product.highlights ? (
                    <ul className="flex flex-col gap-2 mb-6">
                      {product.highlights.map((item) => (
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
                  ) : product.shortDescription !== product.name ? (
                    <p className="text-sm text-dark-grey leading-relaxed mb-6">
                      {product.shortDescription}
                    </p>
                  ) : null}

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
                      {state === "inStock" ? (
                        <AddToCartButton product={product} />
                      ) : null}
                      <TrackedLink
                        href={href}
                        goal="elka_model_click"
                        goalParams={{ slug: product.slug }}
                        className={
                          state === "inStock"
                            ? "inline-flex items-center justify-center rounded-2xl border border-espresso/20 hover:border-espresso text-espresso py-4 transition-colors"
                            : "inline-flex items-center justify-center rounded-2xl bg-espresso hover:bg-terracotta text-parchment py-4 transition-colors"
                        }
                      >
                        {copy.cta}
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
