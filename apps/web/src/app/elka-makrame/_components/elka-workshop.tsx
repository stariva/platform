import { Check, Gift } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ContactMasterButton } from "@/components/stariva/contact-master";
import {
  formatPrice,
  formatReleaseDate,
  type Workshop,
} from "@/lib/workshops-data";
import {
  BONUS_RELEASE_LABEL,
  BONUS_TREE_SIZE,
  WORKSHOP_INCLUDES,
  WORKSHOP_PREORDER_FALLBACK_PRICE,
  WORKSHOP_PROGRAM,
  WORKSHOP_REGULAR_PRICE,
  WORKSHOP_RELEASE_LABEL,
  WORKSHOP_TREE_SIZE,
} from "../_data";
import { WorkshopPreorderButton } from "./workshop-preorder-button";

/**
 * Показывает программу и цену мастер-класса, а для предзаказа — подарок.
 * Если данные курса не переданы, использует цену и дату старта из лендинга.
 */
export function ElkaWorkshop({ workshop }: { workshop?: Workshop }) {
  const price = workshop?.price ?? WORKSHOP_PREORDER_FALLBACK_PRICE;
  const isPreorder = price < WORKSHOP_REGULAR_PRICE;
  const discount = Math.round((1 - price / WORKSHOP_REGULAR_PRICE) * 100);
  const releaseLabel = workshop?.releaseAt
    ? formatReleaseDate(workshop.releaseAt)
    : WORKSHOP_RELEASE_LABEL;

  return (
    <section
      id="workshop"
      aria-labelledby="workshop-title"
      className="bg-sage-pale scroll-mt-24"
    >
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        <div className="lg:sticky lg:top-28">
          <div className="relative aspect-[4/3] rounded-[28px] overflow-hidden bg-linen mb-6">
            <Image
              src="/images/elka/workshop.png"
              alt="Руки мастера плетут ёлку из хлопкового шнура в технике макраме"
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
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

        <div>
          {isPreorder && (
            <p className="inline-flex items-center gap-2 rounded-full bg-terracotta text-parchment px-4 py-2 text-sm mb-6">
              Предзаказ −{discount}% · второй мастер-класс в подарок
            </p>
          )}
          <h2
            id="workshop-title"
            className="font-serif text-espresso leading-tight text-balance mb-5"
            style={{ fontSize: "clamp(30px, 4vw, 48px)" }}
          >
            Сплетите макраме-ёлку своими руками
          </h2>
          <p className="text-dark-grey leading-relaxed mb-8">
            Онлайн-мастер-класс от мастерской Stariva для начинающих: от выбора
            шнура до готовой ёлки {WORKSHOP_TREE_SIZE} на стене. Оплатите
            предзаказ сейчас — зафиксируете цену со скидкой и получите уроки
            первыми, с запасом времени до праздника.
          </p>

          {isPreorder && (
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

          <div className="rounded-[24px] bg-white p-6 lg:p-8">
            <div className="flex items-baseline gap-3 mb-1">
              <span className="font-serif text-4xl text-espresso">
                {formatPrice(price)}
              </span>
              {isPreorder && (
                <s className="text-text-grey">
                  {formatPrice(WORKSHOP_REGULAR_PRICE)}
                </s>
              )}
            </div>
            {isPreorder && (
              <p className="text-sm text-text-grey mb-6">
                Цена предзаказа — до старта {releaseLabel}. Потом —{" "}
                {formatPrice(WORKSHOP_REGULAR_PRICE)}, а мастер-класс по большой
                ёлке уже не будет в подарке.
              </p>
            )}

            {workshop ? (
              <WorkshopPreorderButton
                slug={workshop.slug}
                price={workshop.price}
                title={workshop.title}
              />
            ) : (
              <ContactMasterButton
                source="elka_workshop"
                goal="elka_workshop_waitlist"
                message="Здравствуйте, Ольга! Хочу забронировать место на мастер-классе по макраме-ёлке."
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
                  `Напомним о старте ${releaseLabel}: на email и, по желанию, в Telegram`,
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
        </div>
      </div>
    </section>
  );
}
