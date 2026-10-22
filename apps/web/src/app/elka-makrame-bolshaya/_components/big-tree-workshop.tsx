import { Check } from "lucide-react";
import Image from "next/image";
import { WorkshopPurchase } from "@/app/workshops/[slug]/workshop-purchase";
import { TrackedLink } from "@/components/stariva/tracked-link";
import {
  BIG_TREE_PATH,
  BONUS_TREE_SIZE,
  WORKSHOP_PATH,
  WORKSHOP_TREE_SIZE,
} from "@/lib/elka/data";
import { formatPrice, type Workshop } from "@/lib/workshops-data";
import { WorkshopStickyCta } from "../../elka-makrame/_components/workshop-sticky-cta";
import { WORKSHOP_INCLUDES, WORKSHOP_PROGRAM } from "../../elka-makrame/_data";
import { BUY_ID, bigTreeOffer, QUICK_BUY_ID, SECTION_ID } from "../_data";

/**
 * Первый экран лендинга большой ёлки: оффер, фото, программа и форма оплаты.
 * Устроен как блок маленькой ёлки, но без подарка и с одной ценой.
 */
export function BigTreeWorkshop({
  workshop,
  readyTreePrice,
}: {
  workshop: Workshop;
  /** Самая дешёвая готовая ёлка в полтора метра — для сравнения с ценой уроков. */
  readyTreePrice?: number;
}) {
  const { price, preorder, regularPrice, releaseLabel } =
    bigTreeOffer(workshop);
  const discount = regularPrice
    ? Math.round((1 - price / regularPrice) * 100)
    : 0;
  const buyLabel = `${preorder ? "Оформить предзаказ" : "Купить"} за ${formatPrice(price)}`;
  const program =
    workshop.whatYouLearn.length > 0 ? workshop.whatYouLearn : WORKSHOP_PROGRAM;

  return (
    <section
      id={SECTION_ID}
      aria-labelledby="big-tree-title"
      className="bg-sage-pale scroll-mt-24"
    >
      <WorkshopStickyCta
        label={`${preorder ? "Предзаказ" : "Купить"} за ${formatPrice(price)}`}
        sectionId={SECTION_ID}
        buyId={BUY_ID}
        quickBuyId={QUICK_BUY_ID}
        goal="elka_big_sticky_cta"
      />
      {/* Как у маленькой ёлки: на телефоне сначала оффер и цена, потом фото;
          на десктопе фото слева на всю высоту, текст справа. */}
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 pt-28 pb-16 lg:pt-36 lg:pb-24 grid lg:grid-cols-2 gap-10 lg:gap-x-16 lg:gap-y-0 items-start">
        <div className="lg:col-start-2">
          {preorder && releaseLabel ? (
            <p className="inline-flex items-center gap-3 rounded-2xl bg-terracotta text-parchment py-2 pl-2 pr-5 mb-6 shadow-lg shadow-terracotta/25">
              {discount > 0 && (
                <span className="rounded-xl bg-parchment px-3 py-2 text-xl font-semibold leading-none tabular-nums text-terracotta">
                  −{discount}%
                </span>
              )}
              <span className="text-base font-medium lg:text-lg">
                Предзаказ{" "}
                <span className="whitespace-nowrap">до {releaseLabel}</span>
              </span>
            </p>
          ) : (
            <p className="inline-flex items-center gap-2 rounded-2xl bg-white/80 py-2 px-4 mb-6 text-base font-medium text-espresso lg:text-lg">
              <Check className="size-5 shrink-0 text-sage" aria-hidden />
              Уроки уже открыты — начните сегодня
            </p>
          )}
          <h1
            id="big-tree-title"
            className="font-serif text-espresso leading-tight text-balance mb-5"
            style={{ fontSize: "clamp(32px, 4.6vw, 56px)" }}
          >
            Большая ёлка макраме своими руками
          </h1>
          <p className="text-dark-grey leading-relaxed lg:mb-8">
            Ольга покажет в видеоуроках, как сплести ёлку {BONUS_TREE_SIZE} — в
            полтора метра, для гостиной или праздничной фотозоны. Опыт в макраме
            не нужен.{" "}
            {preorder && releaseLabel
              ? `Уроки откроются ${releaseLabel}, а цену со скидкой можно зафиксировать уже сейчас.`
              : "Уроки появятся в личном кабинете сразу после оплаты."}
          </p>

          <div
            id={QUICK_BUY_ID}
            className="mt-6 flex items-center gap-4 lg:hidden"
          >
            <div className="shrink-0">
              <span className="block font-serif text-3xl leading-none text-espresso">
                {formatPrice(price)}
              </span>
              {regularPrice && (
                <s className="text-sm text-text-grey">
                  {formatPrice(regularPrice)}
                </s>
              )}
            </div>
            <TrackedLink
              href={`#${BUY_ID}`}
              goal="elka_big_quick_buy_cta"
              className="flex flex-1 items-center justify-center rounded-2xl bg-terracotta py-4 text-center text-parchment transition-colors hover:bg-terracotta-dark"
            >
              {preorder ? "Оформить предзаказ" : "Купить мастер-класс"}
            </TrackedLink>
          </div>
        </div>

        <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-28">
          <div className="relative aspect-[4/5] rounded-[28px] overflow-hidden bg-linen mb-6">
            <Image
              src={workshop.cover}
              alt={`Ольга рядом с большой ёлкой макраме ${BONUS_TREE_SIZE} на стене — такую вы сплетёте на мастер-классе`}
              fill
              priority
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover object-top"
            />
          </div>
          <ul className="grid sm:grid-cols-2 gap-3">
            {WORKSHOP_INCLUDES.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 rounded-2xl bg-white/70 p-4 text-sm text-espresso"
              >
                <Check
                  className="size-4 text-sage mt-0.5 shrink-0"
                  aria-hidden
                />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-start-2">
          <h2 className="font-serif text-xl text-espresso mb-4">
            Чему научитесь
          </h2>
          <ol className="flex flex-col gap-3 mb-10">
            {program.map((step, index) => (
              <li key={step} className="flex gap-4 items-start">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white font-serif text-espresso">
                  {index + 1}
                </span>
                <span className="text-espresso pt-1">{step}</span>
              </li>
            ))}
          </ol>

          <div
            id={BUY_ID}
            className="rounded-[24px] bg-white p-6 lg:p-8 scroll-mt-24"
          >
            <div className="flex items-baseline gap-3 mb-1">
              <span className="font-serif text-4xl text-espresso">
                {formatPrice(price)}
              </span>
              {regularPrice && (
                <s className="text-text-grey">{formatPrice(regularPrice)}</s>
              )}
            </div>
            <p className="text-sm text-text-grey mb-6">
              {preorder && releaseLabel && regularPrice
                ? `Цена предзаказа. С ${releaseLabel} — ${formatPrice(regularPrice)}.`
                : "Видеоуроки, схема и список материалов — доступ навсегда."}
            </p>
            {readyTreePrice ? (
              <p className="-mt-3 mb-6 rounded-2xl bg-sage-pale px-4 py-3 text-sm leading-relaxed text-espresso">
                Готовая ёлка ручной работы в полтора метра стоит от{" "}
                <span className="whitespace-nowrap">
                  {formatPrice(readyTreePrice)}
                </span>
                , а по урокам вы сплетёте такую сами.
              </p>
            ) : null}
            <WorkshopPurchase
              slug={workshop.slug}
              price={workshop.price}
              title={workshop.title}
              returnPath={`${BIG_TREE_PATH}#${SECTION_ID}`}
              preorder={preorder}
              buyLabel={buyLabel}
              buyGoal="elka_big_tree_buy"
            />
            <ol
              aria-label="Как проходит запись"
              className="mt-5 grid gap-3 border-t border-espresso/10 pt-5 text-sm text-dark-grey"
            >
              {[
                "Оплата картой или СБП через ЮKassa — без регистрации",
                "Сразу после оплаты — письмо со ссылкой на личный кабинет",
                preorder && releaseLabel
                  ? `Напомним о старте ${releaseLabel}: на email и, по желанию, в Telegram`
                  : "Уроки открываются сразу — смотрите с телефона или компьютера",
              ].map((step, index) => (
                <li key={step} className="flex gap-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sage-pale font-serif text-xs text-espresso">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {workshop.materials.length > 0 ? (
            <div className="mt-10">
              <h2 className="font-serif text-xl text-espresso mb-4">
                Что понадобится
              </h2>
              <ul className="grid gap-2 text-sm text-espresso">
                {workshop.materials.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check
                      className="size-4 text-sage mt-0.5 shrink-0"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-10 text-sm text-dark-grey">
            Для стены поменьше есть{" "}
            <TrackedLink
              href={WORKSHOP_PATH}
              goal="elka_big_small_tree"
              className="underline underline-offset-4 hover:text-terracotta"
            >
              мастер-класс по ёлке {WORKSHOP_TREE_SIZE}
            </TrackedLink>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
