import { Check } from "lucide-react";
import Image from "next/image";
import { AddToCartButton } from "@/components/stariva/add-to-cart-button";
import { TrackedLink } from "@/components/stariva/tracked-link";
import type { Product } from "@/lib/catalog/types";
import { isPurchasable } from "@/lib/in-stock";
import { productHref } from "@/lib/products";
import { formatPrice } from "@/lib/workshops-data";
import { GNOMES_CARDS_ID, type pairOffer } from "../_data";

/** Чем гномы различаются — коротко, чтобы выбрать одного или взять обоих. */
const CHARACTER: Record<string, string[]> = {
  "-9563": [
    "Колпак-тыква с зелёным хвостиком, коричневый кафтан",
    "Самый «осенний»: тёплая палитра охры и терракоты",
    "Подойдёт интерьеру в стиле кантри, бохо или деревенском",
  ],
  "-0554": [
    "Красный колпак с белыми точками, красные варежки",
    "Осенью — как лесной гриб, в декабре — новогодний акцент",
    "Хорош в светлом скандинавском интерьере с одним ярким пятном",
  ],
};

function characterOf(product: Product): string[] {
  const tail = Object.keys(CHARACTER).find((key) => product.slug.endsWith(key));
  return tail ? (CHARACTER[tail] ?? []) : [];
}

export function GnomesCards({
  gnomes,
  offer,
}: {
  gnomes: Product[];
  offer: ReturnType<typeof pairOffer>;
}) {
  return (
    <section
      id={GNOMES_CARDS_ID}
      aria-labelledby="gnomes-cards-title"
      className="bg-white scroll-mt-24"
    >
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 py-16 lg:py-24">
        <div className="max-w-2xl mb-12">
          <p className="label-caps text-terracotta text-[11px] mb-4">
            Знакомьтесь
          </p>
          <h2
            id="gnomes-cards-title"
            className="font-serif text-espresso leading-tight text-balance mb-4"
            style={{ fontSize: "clamp(30px, 4vw, 48px)" }}
          >
            Тыква и Мухомор
          </h2>
          <p className="text-dark-grey leading-relaxed">
            Каждый гном связан в единственном экземпляре — таким, как на фото.
            Выберите одного или поставьте пару на разной высоте: так они не
            спорят друг с другом.
            {offer.isPair && offer.saving > 0
              ? ` Оба вместе — ${formatPrice(offer.price)} вместо ${formatPrice(offer.regularPrice)}: цена комплекта применится в корзине сама.`
              : null}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-10">
          {gnomes.map((product) => {
            const { price, oldPrice } = product;
            const purchasable = isPurchasable(product);
            const image = product.images[0];
            return (
              <article
                key={product.id}
                className="flex flex-col rounded-[28px] bg-parchment overflow-hidden"
                data-cart-fly-scope
              >
                <div
                  className="relative aspect-[4/5] bg-linen"
                  data-cart-fly-source
                >
                  {image ? (
                    <Image
                      src={image}
                      alt={product.name}
                      fill
                      sizes="(min-width: 768px) 45vw, 100vw"
                      className="object-cover"
                    />
                  ) : null}
                  <span className="absolute top-4 left-4 rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-xs text-espresso">
                    {purchasable ? "В наличии" : "Нет в наличии"}
                  </span>
                </div>

                <div className="flex flex-col flex-1 p-6 lg:p-8">
                  <h3 className="font-serif text-2xl text-espresso mb-2">
                    {product.name}
                  </h3>
                  {product.dimensions ? (
                    <p className="text-sm text-text-grey mb-5">
                      {product.dimensions} · {product.material}
                    </p>
                  ) : null}
                  <ul className="flex flex-col gap-2 mb-6">
                    {characterOf(product).map((item) => (
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
                      <AddToCartButton product={product} />
                      <TrackedLink
                        href={productHref(product)}
                        goal="gnomes_card_click"
                        goalParams={{ slug: product.slug }}
                        className="inline-flex items-center justify-center rounded-2xl border border-espresso/20 hover:border-espresso text-espresso py-4 transition-colors"
                      >
                        Подробнее
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
