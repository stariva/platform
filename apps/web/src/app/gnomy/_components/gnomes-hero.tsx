import { Check } from "lucide-react";
import Image from "next/image";
import { NewYearCountdown } from "@/components/stariva/new-year-countdown";
import { TrackedLink } from "@/components/stariva/tracked-link";
import type { Product } from "@/lib/catalog/types";
import { IN_STOCK_SHIP_DAYS } from "@/lib/in-stock";
import { formatPrice } from "@/lib/workshops-data";
import {
  GNOMES_CARDS_ID,
  GNOMES_SECTION_ID,
  heroCopy,
  pairButtonLabel,
  type pairOffer,
} from "../_data";
import { AddPairButton } from "./add-pair-button";

const FACTS = [
  "Связаны вручную из плюшевой пряжи",
  `Уже в наличии — отправим за ${IN_STOCK_SHIP_DAYS}`,
  "Доставка в пункты выдачи Ozon по России",
  "Упаковка в крафт и лён — в подарок",
];

/**
 * Первый экран: оба гнома на одном фото-ряду, цена пары и кнопка «в корзину».
 * Фото — из карточек товаров, поэтому всегда те, что в каталоге.
 */
export function GnomesHero({
  gnomes,
  offer,
}: {
  gnomes: Product[];
  offer: ReturnType<typeof pairOffer>;
}) {
  const { price, regularPrice, saving, isPair, available } = offer;
  const copy = heroCopy(offer);
  const facts = copy.inStock
    ? FACTS
    : FACTS.filter((fact) => !fact.startsWith("Уже в наличии"));
  return (
    <section
      id={GNOMES_SECTION_ID}
      aria-labelledby="gnomes-title"
      className="bg-parchment scroll-mt-24"
    >
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 pt-28 pb-16 lg:pt-36 lg:pb-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-sage-pale text-espresso px-4 py-2 text-sm mb-6">
            <span className="size-2 rounded-full bg-terracotta" aria-hidden />
            До Нового года <NewYearCountdown />
          </p>
          <h1
            id="gnomes-title"
            className="font-serif text-espresso leading-[1.08] text-balance mb-6"
            style={{ fontSize: "clamp(34px, 5vw, 62px)" }}
          >
            {copy.title} —{" "}
            <em className="not-italic text-taupe">от осени до Нового года</em>
          </h1>
          <p className="text-lg text-dark-grey leading-relaxed max-w-xl mb-8 text-pretty">
            {copy.lead}
          </p>

          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-5">
            <span className="font-serif text-4xl text-espresso">
              {price > 0 ? formatPrice(price) : "Нет в наличии"}
            </span>
            {saving > 0 ? (
              <>
                <s className="text-text-grey">{formatPrice(regularPrice)}</s>
                <span className="rounded-full bg-terracotta px-3 py-1 text-sm text-parchment">
                  −{formatPrice(saving)}
                </span>
              </>
            ) : null}
            {isPair ? (
              <span className="text-sm text-text-grey">за пару</span>
            ) : null}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <AddPairButton
              products={available}
              label={pairButtonLabel(offer)}
              goal="gnomes_hero_buy"
            />
            <TrackedLink
              href={`#${GNOMES_CARDS_ID}`}
              goal="gnomes_hero_cards"
              className="inline-flex items-center justify-center rounded-2xl border border-espresso/20 hover:border-espresso text-espresso px-8 py-4 text-base transition-colors"
            >
              Посмотреть каждого
            </TrackedLink>
          </div>

          <ul className="grid sm:grid-cols-2 gap-3 max-w-xl">
            {facts.map((fact) => (
              <li
                key={fact}
                className="flex items-start gap-2 text-sm text-espresso"
              >
                <Check
                  className="size-4 text-sage mt-0.5 shrink-0"
                  aria-hidden
                />
                {fact}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {gnomes.map((gnome, index) => (
            <figure
              key={gnome.slug}
              className="relative aspect-[3/4] rounded-[24px] overflow-hidden bg-linen"
            >
              {gnome.images[0] ? (
                <Image
                  src={gnome.images[0]}
                  alt={`${gnome.name} — интерьерное украшение ручной вязки`}
                  fill
                  priority={index === 0}
                  sizes="(min-width: 1024px) 22vw, 50vw"
                  className="object-cover"
                />
              ) : null}
              {gnome.dimensions ? (
                <figcaption className="absolute left-3 bottom-3 rounded-full bg-white/90 px-3 py-1 text-sm text-espresso">
                  {gnome.dimensions}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
