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
interface CardCopy {
  /** Название и параметры для лендинга — в каталоге они суше. */
  name: string;
  params: string;
  points: string[];
}

const CARDS: Record<string, CardCopy> = {
  "-9563": {
    name: "Большой вязаный гном «Тыква» ручной работы, 45 см",
    params: "Высота 45 см · Нежная плюшевая пряжа",
    points: [
      "Высокий тыквенно-рыжий колпак с зелёным хвостиком и уютный шоколадный кафтан",
      "Тёплые оттенки мёда, корицы и шоколада — мягко светятся рядом со свечами и гирляндой",
      "В северной традиции такой гном в доме — к достатку, сытости и теплу",
    ],
  },
  "-0554": {
    name: "Большой вязаный гном «Мухомор» ручной работы, 40 см",
    params: "Высота 40 см · Нежная плюшевая пряжа",
    points: [
      "Нарядный красный колпак в белую горошину, пушистая борода и красные варежки",
      "Главные цвета Нового года — сочный красный и снежно-белый, как на рождественской открытке",
      "Сразу создаёт праздничное настроение и становится ярким акцентом в светлой комнате",
    ],
  },
};

function cardCopyOf(product: Product): CardCopy {
  const tail = Object.keys(CARDS).find((key) => product.slug.endsWith(key));
  return (
    (tail ? CARDS[tail] : undefined) ?? {
      name: product.name,
      params: [product.dimensions, product.material]
        .filter(Boolean)
        .join(" · "),
      points: [],
    }
  );
}

function stockBadge(product: Product): string {
  if (!isPurchasable(product)) return "Нет в наличии";
  return product.stockAvailable > 0
    ? `В наличии (${product.stockAvailable} шт.)`
    : "В наличии";
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
            Каждый гном связан вручную в единственном экземпляре — вы получите
            именно тех хранителей, что видите на фото. Можно забрать одного, но
            в паре они смотрятся как законченная живая история: разная высота
            колпаков (40 и 45 см) создаёт красивый объём.
            {offer.isPair && offer.saving > 0
              ? ` Вместе выгоднее — ${formatPrice(offer.price)} вместо ${formatPrice(offer.regularPrice)} (скидка ${formatPrice(offer.saving)} посчитается в корзине сама).`
              : null}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-10">
          {gnomes.map((product) => {
            const { price, oldPrice } = product;
            const copy = cardCopyOf(product);
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
                    {stockBadge(product)}
                  </span>
                </div>

                <div className="flex flex-col flex-1 p-6 lg:p-8">
                  <h3 className="font-serif text-2xl text-espresso mb-2">
                    {copy.name}
                  </h3>
                  {copy.params ? (
                    <p className="text-sm text-text-grey mb-5">{copy.params}</p>
                  ) : null}
                  <ul className="flex flex-col gap-2 mb-6">
                    {copy.points.map((item) => (
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
