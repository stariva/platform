import Image from "next/image";
import { AddToCartButton } from "@/components/stariva/add-to-cart-button";
import { TrackedLink } from "@/components/stariva/tracked-link";
import { isPurchasable } from "@/lib/in-stock";
import { madeToOrderLeadTime } from "@/lib/made-to-order";
import type { Product } from "@/lib/ozon-types";
import { formatPrice } from "@/lib/workshops-data";
import { TREES_MODELS_ID } from "../_data";

export function ElkaModels({ trees }: { trees: Product[] }) {
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
            Каталог временно недоступен. Напишите Ольге — она подскажет цену и
            сроки.
          </p>
        ) : null}

        <div className="grid md:grid-cols-2 gap-6 lg:gap-10">
          {trees.map((product) => {
            const { price, oldPrice } = product;
            const details = [product.dimensions, product.color]
              .filter(Boolean)
              .join(" · ");
            const image = product.images[0];
            const href = `/catalog/${product.category}/${product.slug}`;
            // Товар, который можно положить в корзину; иначе — заказ у мастера.
            const purchasable = isPurchasable(product) ? product : undefined;
            const availability = purchasable
              ? "В наличии"
              : product.madeToOrder
                ? `Под заказ ${madeToOrderLeadTime(product)}`
                : "Нет в наличии";
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
                      {availability}
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
                  {product.shortDescription !== product.name ? (
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
                      {purchasable ? (
                        <AddToCartButton product={purchasable} />
                      ) : null}
                      <TrackedLink
                        href={href}
                        goal="elka_model_click"
                        goalParams={{ slug: product.slug }}
                        className={
                          purchasable
                            ? "inline-flex items-center justify-center rounded-2xl border border-espresso/20 hover:border-espresso text-espresso py-4 transition-colors"
                            : "inline-flex items-center justify-center rounded-2xl bg-espresso hover:bg-terracotta text-parchment py-4 transition-colors"
                        }
                      >
                        {purchasable || !product.madeToOrder
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
