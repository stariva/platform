import { Check, Gift } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ContactMasterButton } from "@/components/stariva/contact-master";
import { TrackedLink } from "@/components/stariva/tracked-link";
import {
  BONUS_RELEASE_LABEL,
  BONUS_TREE_SIZE,
  fallbackWorkshopPrice,
  WORKSHOP_REGULAR_PRICE,
  WORKSHOP_RELEASE_LABEL,
  WORKSHOP_TREE_SIZE,
} from "@/lib/elka/data";
import {
  formatPrice,
  formatReleaseDate,
  isPreorder,
  type Workshop,
} from "@/lib/workshops-data";
import {
  BIG_TREE_ID,
  READY_TREES_ID,
  WORKSHOP_BUY_ID,
  WORKSHOP_INCLUDES,
  WORKSHOP_PROGRAM,
  WORKSHOP_QUICK_BUY_ID,
  WORKSHOP_SECTION_ID,
} from "../_data";
import { WorkshopPreorderButton } from "./workshop-preorder-button";
import { WorkshopStickyCta } from "./workshop-sticky-cta";

/** Предзаказ и старт мастер-класса; без базы — по запасной дате лендинга. */
export function workshopOffer(workshop?: Workshop, now = new Date()) {
  if (!workshop) {
    const price = fallbackWorkshopPrice(now);
    const preorder = price < WORKSHOP_REGULAR_PRICE;
    return {
      price,
      preorder,
      regularPrice: preorder ? WORKSHOP_REGULAR_PRICE : undefined,
      releaseLabel: WORKSHOP_RELEASE_LABEL,
    };
  }
  return {
    price: workshop.price,
    preorder: isPreorder(workshop, now),
    regularPrice: workshop.regularPrice,
    releaseLabel: workshop.releaseAt
      ? formatReleaseDate(workshop.releaseAt)
      : WORKSHOP_RELEASE_LABEL,
  };
}

/**
 * Программа и цена мастер-класса. До старта — предзаказ со скидкой и
 * подарком, после — обычная покупка и предзаказ большой ёлки, если он есть.
 */
export function ElkaWorkshop({
  workshop,
  bigTree,
  readyTreePrice,
}: {
  workshop?: Workshop;
  /** Мастер-класс по большой ёлке; есть, только когда его продают. */
  bigTree?: Workshop;
  /** Самая дешёвая готовая ёлка из каталога — для сравнения с ценой уроков. */
  readyTreePrice?: number;
}) {
  const { price, preorder, regularPrice, releaseLabel } =
    workshopOffer(workshop);
  const discount = regularPrice
    ? Math.round((1 - price / regularPrice) * 100)
    : 0;

  return (
    <section
      id={WORKSHOP_SECTION_ID}
      aria-labelledby="workshop-title"
      className="bg-sage-pale scroll-mt-24"
    >
      {workshop ? (
        <WorkshopStickyCta
          label={`${preorder ? "Предзаказ" : "Купить"} за ${formatPrice(price)}`}
        />
      ) : null}
      {/* Первый экран страницы. На телефоне сначала оффер и цена, потом фото:
          первый экран не должен быть одной картинкой. На десктопе фото слева
          на всю высоту, текст справа. Сверху — отступ под фиксированную шапку. */}
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 pt-28 pb-16 lg:pt-36 lg:pb-24 grid lg:grid-cols-2 gap-10 lg:gap-x-16 lg:gap-y-0 items-start">
        <div className="lg:col-start-2">
          {preorder ? (
            <p className="inline-flex items-center gap-3 rounded-2xl bg-terracotta text-parchment py-2 pl-2 pr-5 mb-6 shadow-lg shadow-terracotta/25">
              {discount > 0 && (
                <span className="rounded-xl bg-parchment px-3 py-2 text-xl font-semibold leading-none tabular-nums text-terracotta">
                  −{discount}%
                </span>
              )}
              <Gift className="hidden size-5 shrink-0 sm:block" aria-hidden />
              {/* Переносим по «·», а не посреди «мастер-класс». На узких
                  экранах (320px) допускаем перенос и после «Предзаказ». */}
              <span className="flex flex-wrap gap-x-1.5 text-base font-medium lg:text-lg">
                <span>
                  Предзаказ{" "}
                  <span className="whitespace-nowrap">до {releaseLabel} ·</span>
                </span>
                <span>второй мастер&#8209;класс в подарок</span>
              </span>
            </p>
          ) : (
            <p className="inline-flex items-center gap-2 rounded-2xl bg-white/80 py-2 px-4 mb-6 text-base font-medium text-espresso lg:text-lg">
              <Check className="size-5 shrink-0 text-sage" aria-hidden />
              Уроки уже открыты — начните сегодня
            </p>
          )}
          <h1
            id="workshop-title"
            className="font-serif text-espresso leading-tight text-balance mb-5"
            style={{ fontSize: "clamp(32px, 4.6vw, 56px)" }}
          >
            Сплетите ёлку макраме своими руками
          </h1>
          <p className="text-dark-grey leading-relaxed lg:mb-8">
            Ольга покажет в видеоуроках, как шаг за шагом сплести ёлку{" "}
            {WORKSHOP_TREE_SIZE} — от выбора шнура до готового панно на стене.{" "}
            {preorder
              ? "Оплатите предзаказ сейчас — зафиксируете цену со скидкой и получите уроки первыми, с запасом времени до праздника."
              : "Уроки появятся в личном кабинете сразу после оплаты — плетите в своём темпе и успейте к празднику."}
          </p>

          {workshop ? (
            <div
              id={WORKSHOP_QUICK_BUY_ID}
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
                href={`#${WORKSHOP_BUY_ID}`}
                goal="elka_quick_buy_cta"
                className="flex flex-1 items-center justify-center rounded-2xl bg-terracotta py-4 text-center text-parchment transition-colors hover:bg-terracotta-dark"
              >
                {preorder ? "Оформить предзаказ" : "Купить мастер-класс"}
              </TrackedLink>
            </div>
          ) : null}
        </div>

        <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-28">
          <div className="relative aspect-[4/5] rounded-[28px] overflow-hidden bg-linen mb-6">
            <Image
              src="https://cdn.stariva.ru/site/images/elka/masterclass-elka-makrame.webp"
              alt="Мастер Stariva украшает бусинами зелёную ёлку макраме на стене — такую вы сплетёте на мастер-классе"
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
          {preorder && (
            <div className="mb-10 flex gap-4 rounded-[24px] border border-terracotta/30 bg-white p-6">
              <Gift
                className="mt-0.5 size-6 shrink-0 text-terracotta"
                aria-hidden
              />
              <div>
                <h3 className="mb-1 font-serif text-xl text-espresso">
                  Второй мастер-класс — в подарок
                </h3>
                <p className="text-sm leading-relaxed text-dark-grey">
                  Всего будет два мастер-класса по ёлке: {WORKSHOP_TREE_SIZE} и
                  большая {BONUS_TREE_SIZE}. Оформите предзаказ первого сейчас —
                  и второй откроется вам бесплатно {BONUS_RELEASE_LABEL}.
                </p>
              </div>
            </div>
          )}

          <h3 className="font-serif text-xl text-espresso mb-4">
            Чему научитесь
          </h3>
          <ol className="flex flex-col gap-3 mb-6">
            {WORKSHOP_PROGRAM.map((step, index) => (
              <li key={step} className="flex gap-4 items-start">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white font-serif text-espresso">
                  {index + 1}
                </span>
                <span className="text-espresso pt-1">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mb-10 text-sm text-dark-grey">
            Какой шнур взять и на чём спотыкаются новички —{" "}
            <Link
              href="/blog/elka-iz-makrame-svoimi-rukami"
              className="underline underline-offset-4 hover:text-terracotta"
            >
              читайте в блоге
            </Link>
          </p>

          <div
            id={WORKSHOP_BUY_ID}
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
              {preorder
                ? `Сейчас — два мастер-класса по цене предзаказа. С ${releaseLabel} — один, за ${formatPrice(regularPrice ?? price)}.`
                : "Видеоуроки, схема и список материалов — доступ навсегда."}
            </p>
            {/* Честный ориентир вместо зачёркнутой цены: после старта курс
                продаётся по обычной цене, а сравниваем с готовой ёлкой. */}
            {!preorder && readyTreePrice ? (
              <p className="-mt-3 mb-6 rounded-2xl bg-sage-pale px-4 py-3 text-sm leading-relaxed text-espresso">
                Готовая ёлка ручной работы стоит{" "}
                <TrackedLink
                  href={`#${READY_TREES_ID}`}
                  goal="elka_price_compare_ready"
                  className="whitespace-nowrap underline underline-offset-4 hover:text-terracotta"
                >
                  от {formatPrice(readyTreePrice)}
                </TrackedLink>
                . Здесь вы платите за уроки и шнур, а по схеме потом сплетёте
                сколько угодно ёлок.
              </p>
            ) : null}

            {workshop ? (
              <WorkshopPreorderButton
                slug={workshop.slug}
                price={workshop.price}
                title={workshop.title}
                preorder={preorder}
              />
            ) : (
              <ContactMasterButton
                source="elka_workshop"
                goal="elka_workshop_waitlist"
                message="Здравствуйте, Ольга! Хочу забронировать место на мастер-классе по ёлке макраме."
                className="flex w-full items-center justify-center rounded-2xl bg-terracotta hover:bg-terracotta-dark text-parchment py-4 mb-3 transition-colors"
              >
                Забронировать место у мастера
              </ContactMasterButton>
            )}
            {workshop ? (
              <ol
                aria-label="Как проходит запись"
                className="mt-5 grid gap-3 border-t border-espresso/10 pt-5 text-sm text-dark-grey"
              >
                {[
                  "Оплата картой или СБП через ЮKassa — без регистрации",
                  "Сразу после оплаты — письмо со ссылкой на личный кабинет",
                  preorder
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
            ) : null}
          </div>

          {!preorder && bigTree ? <BigTreeOffer bigTree={bigTree} /> : null}
        </div>
      </div>
    </section>
  );
}

/**
 * Следующий мастер-класс — большая ёлка. Появляется, когда маленькая уже
 * вышла и большую перестали дарить за предзаказ.
 */
function BigTreeOffer({ bigTree }: { bigTree: Workshop }) {
  const preorder = isPreorder(bigTree) && bigTree.releaseAt;
  return (
    <div
      id={BIG_TREE_ID}
      className="mt-6 rounded-[24px] border border-terracotta/30 bg-white p-6 lg:p-8 scroll-mt-24"
    >
      <p className="label-caps mb-2 text-[11px] text-terracotta">
        {preorder
          ? `Предзаказ до ${formatReleaseDate(preorder)}`
          : "Второй мастер-класс"}
      </p>
      <h3 className="mb-2 font-serif text-2xl text-espresso">
        Большая ёлка {BONUS_TREE_SIZE}
      </h3>
      <p className="mb-5 text-sm leading-relaxed text-dark-grey">
        {preorder
          ? `Отдельный мастер-класс по ёлке в полтора метра — для просторной стены. Уроки откроются ${formatReleaseDate(preorder)}; оформите предзаказ сейчас — по цене со скидкой.`
          : "Отдельный мастер-класс по ёлке в полтора метра — для просторной стены."}
      </p>
      <div className="mb-5 flex items-baseline gap-3">
        <span className="font-serif text-3xl text-espresso">
          {formatPrice(bigTree.price)}
        </span>
        {bigTree.regularPrice && (
          <s className="text-text-grey">{formatPrice(bigTree.regularPrice)}</s>
        )}
      </div>
      <WorkshopPreorderButton
        slug={bigTree.slug}
        price={bigTree.price}
        title={bigTree.title}
        preorder={Boolean(preorder)}
        goal="elka_big_tree_buy"
      />
    </div>
  );
}
