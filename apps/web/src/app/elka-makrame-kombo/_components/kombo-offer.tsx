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
import type { WorkshopBundle } from "@/lib/workshops/bundles";
import { formatPrice, type Workshop } from "@/lib/workshops-data";
import { WorkshopStickyCta } from "../../elka-makrame/_components/workshop-sticky-cta";
import { WORKSHOP_INCLUDES, WORKSHOP_PROGRAM } from "../../elka-makrame/_data";
import { BUY_ID, komboOffer, QUICK_BUY_ID, SECTION_ID } from "../_data";

/**
 * Первый экран лендинга комбо: две ёлки, цена против покупки по отдельности,
 * программа и форма оплаты. Сетка — как у лендинга большой ёлки.
 */
export function KomboOffer({
  bundle,
  small,
  big,
}: {
  bundle: WorkshopBundle;
  /** Основной курс комбо: на него оформляется заказ. */
  small: Workshop;
  big: Workshop;
}) {
  const { price, separately, saving, bigReleaseLabel } = komboOffer(
    bundle,
    small,
    big,
  );
  const program =
    small.whatYouLearn.length > 0 ? small.whatYouLearn : WORKSHOP_PROGRAM;
  const trees = [
    {
      workshop: small,
      name: "Ёлка",
      size: WORKSHOP_TREE_SIZE,
      text: "Для небольшой стены, детской или прихожей. С неё удобно начать: все узлы — шаг за шагом.",
      status: "Уроки открыты сразу",
      href: WORKSHOP_PATH,
      goal: "elka_kombo_small_more",
    },
    {
      workshop: big,
      name: "Большая ёлка",
      size: BONUS_TREE_SIZE,
      text: "В полтора метра — для гостиной или праздничной фотозоны. Те же узлы, только больше рядов.",
      status: bigReleaseLabel
        ? `Уроки откроются ${bigReleaseLabel}`
        : "Уроки открыты сразу",
      href: BIG_TREE_PATH,
      goal: "elka_kombo_big_more",
    },
  ];

  return (
    <section
      id={SECTION_ID}
      aria-labelledby="kombo-title"
      className="bg-sage-pale scroll-mt-24"
    >
      <WorkshopStickyCta
        label={`Комбо за ${formatPrice(price)}`}
        sectionId={SECTION_ID}
        buyId={BUY_ID}
        quickBuyId={QUICK_BUY_ID}
        goal="elka_kombo_sticky_cta"
      />
      {/* На телефоне сначала оффер и цена, потом фото; на десктопе фото
          слева на всю высоту, текст справа. */}
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 pt-28 pb-16 lg:pt-36 lg:pb-24 grid lg:grid-cols-2 gap-10 lg:gap-x-16 lg:gap-y-0 items-start">
        <div className="lg:col-start-2">
          <p className="inline-flex items-center gap-3 rounded-2xl bg-terracotta text-parchment py-2 pl-2 pr-5 mb-6 shadow-lg shadow-terracotta/25">
            <span className="rounded-xl bg-parchment px-3 py-2 text-xl font-semibold leading-none tabular-nums text-terracotta whitespace-nowrap">
              2 в 1
            </span>
            <span className="text-base font-medium lg:text-lg">
              Два мастер-класса{" "}
              <span className="whitespace-nowrap">за {formatPrice(price)}</span>
            </span>
          </p>
          <h1
            id="kombo-title"
            className="font-serif text-espresso leading-tight text-balance mb-5"
            style={{ fontSize: "clamp(32px, 4.6vw, 56px)" }}
          >
            Две ёлки макраме своими руками
          </h1>
          <p className="text-dark-grey leading-relaxed lg:mb-8">
            Комбо из двух мастер-классов Ольги в видеоуроках: ёлка{" "}
            {WORKSHOP_TREE_SIZE} и большая {BONUS_TREE_SIZE}. Сплетите одну для
            себя, другую — в подарок или для второй комнаты. Опыт в макраме не
            нужен.
            {saving > 0
              ? ` Вместе — ${formatPrice(price)} вместо ${formatPrice(separately)}.`
              : null}
          </p>

          <div
            id={QUICK_BUY_ID}
            className="mt-6 flex items-center gap-4 lg:hidden"
          >
            <div className="shrink-0">
              <span className="block font-serif text-3xl leading-none text-espresso">
                {formatPrice(price)}
              </span>
              {saving > 0 && (
                <s className="text-sm text-text-grey">
                  {formatPrice(separately)}
                </s>
              )}
            </div>
            <TrackedLink
              href={`#${BUY_ID}`}
              goal="elka_kombo_quick_buy_cta"
              className="flex flex-1 items-center justify-center rounded-2xl bg-terracotta py-4 text-center text-parchment transition-colors hover:bg-terracotta-dark"
            >
              Купить комбо
            </TrackedLink>
          </div>
        </div>

        <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-28">
          <div className="grid grid-cols-2 gap-3 mb-6">
            {trees.map((tree) => (
              <figure
                key={tree.workshop.slug}
                className="relative aspect-[3/4] rounded-[24px] overflow-hidden bg-linen"
              >
                <Image
                  src={tree.workshop.cover}
                  alt={`${tree.name} макраме ${tree.size} — такую вы сплетёте по урокам комбо`}
                  fill
                  priority
                  sizes="(min-width: 1024px) 22vw, 50vw"
                  className="object-cover object-top"
                />
                <figcaption className="absolute left-3 bottom-3 rounded-full bg-white/90 px-3 py-1 text-sm text-espresso">
                  {tree.size}
                </figcaption>
              </figure>
            ))}
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
            Что входит в комбо
          </h2>
          <ul className="grid sm:grid-cols-2 gap-3 mb-10">
            {trees.map((tree) => (
              <li
                key={tree.workshop.slug}
                className="flex flex-col rounded-[20px] bg-white/80 p-5"
              >
                <span className="font-serif text-lg text-espresso">
                  {tree.name}{" "}
                  <span className="whitespace-nowrap">{tree.size}</span>
                </span>
                <span className="mt-1 mb-3 inline-flex items-center gap-1.5 text-sm text-sage">
                  <Check className="size-4 shrink-0" aria-hidden />
                  {tree.status}
                </span>
                <span className="text-sm leading-relaxed text-dark-grey mb-3">
                  {tree.text}
                </span>
                <span className="mt-auto flex items-baseline justify-between gap-3 text-sm text-text-grey">
                  <span>
                    Отдельно —{" "}
                    <span className="whitespace-nowrap">
                      {formatPrice(tree.workshop.price)}
                    </span>
                  </span>
                  <TrackedLink
                    href={tree.href}
                    goal={tree.goal}
                    className="underline underline-offset-4 hover:text-terracotta"
                  >
                    Подробнее
                  </TrackedLink>
                </span>
              </li>
            ))}
          </ul>

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
              {saving > 0 && (
                <s className="text-text-grey">{formatPrice(separately)}</s>
              )}
            </div>
            <p className="text-sm text-text-grey mb-6">
              {saving > 0
                ? `Два мастер-класса одним заказом — экономия ${formatPrice(saving)}.`
                : "Два мастер-класса одним заказом."}{" "}
              Видеоуроки, схемы и списки материалов — доступ навсегда.
            </p>
            <WorkshopPurchase
              slug={small.slug}
              bundle={bundle.slug}
              price={price}
              title={`Комбо «${bundle.title}»`}
              returnPath={`${bundle.path}#${SECTION_ID}`}
              buyLabel={`Купить комбо за ${formatPrice(price)}`}
              buyGoal="elka_kombo_buy"
            />
            <ol
              aria-label="Как проходит запись"
              className="mt-5 grid gap-3 border-t border-espresso/10 pt-5 text-sm text-dark-grey"
            >
              {[
                "Оплата картой или СБП через ЮKassa — без регистрации",
                "Сразу после оплаты — письмо со ссылкой на личный кабинет",
                bigReleaseLabel
                  ? `Ёлка ${WORKSHOP_TREE_SIZE} откроется сразу, большая — ${bigReleaseLabel}`
                  : "Оба мастер-класса открываются сразу — с телефона или компьютера",
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
        </div>
      </div>
    </section>
  );
}
