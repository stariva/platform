import { Check } from "lucide-react";
import Image from "next/image";
import {
  formatPrice,
  formatReleaseDate,
  type Workshop,
} from "@/lib/workshops-data";
import {
  PHONE_HREF,
  PHONE_LABEL,
  TELEGRAM_URL,
  WORKSHOP_INCLUDES,
  WORKSHOP_PREORDER_FALLBACK_PRICE,
  WORKSHOP_PROGRAM,
  WORKSHOP_REGULAR_PRICE,
  WORKSHOP_RELEASE_LABEL,
} from "../_data";
import { TrackedLink } from "./tracked-link";
import { WorkshopPreorderButton } from "./workshop-preorder-button";

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
              Предзаказ −{discount}% · старт {releaseLabel}
            </p>
          )}
          <h2
            id="workshop-title"
            className="font-serif text-espresso leading-tight text-balance mb-5"
            style={{ fontSize: "clamp(30px, 4vw, 48px)" }}
          >
            Сплетите ёлку из макраме своими руками
          </h2>
          <p className="text-dark-grey leading-relaxed mb-8">
            Онлайн-мастер-класс от Ольги Старивы для начинающих: от выбора шнура
            до готовой ёлки на стене. Оплатите предзаказ сейчас — зафиксируете
            цену со скидкой и получите уроки первыми, с запасом времени до
            праздника.
          </p>

          <h3 className="font-serif text-xl text-espresso mb-4">
            Чему научитесь
          </h3>
          <ol className="flex flex-col gap-3 mb-10">
            {WORKSHOP_PROGRAM.map((step, index) => (
              <li key={step} className="flex gap-4 items-start">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white font-serif text-espresso">
                  {index + 1}
                </span>
                <span className="text-espresso pt-1">{step}</span>
              </li>
            ))}
          </ol>

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
                Цена предзаказа. После старта —{" "}
                {formatPrice(WORKSHOP_REGULAR_PRICE)}.
              </p>
            )}

            {workshop ? (
              <WorkshopPreorderButton
                slug={workshop.slug}
                price={workshop.price}
                title={workshop.title}
              />
            ) : (
              <>
                <TrackedLink
                  href={PHONE_HREF}
                  goal="elka_workshop_waitlist"
                  goalParams={{ channel: "phone" }}
                  className="flex w-full items-center justify-center rounded-2xl bg-terracotta hover:bg-terracotta-dark text-parchment py-4 mb-3 transition-colors"
                >
                  Записаться по телефону {PHONE_LABEL}
                </TrackedLink>
                <p className="text-sm text-text-grey text-center mb-3">
                  или напишите в{" "}
                  <TrackedLink
                    href={TELEGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    goal="elka_workshop_waitlist"
                    goalParams={{ channel: "telegram" }}
                    className="text-terracotta underline-offset-2 hover:underline"
                  >
                    Telegram
                  </TrackedLink>
                </p>
              </>
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
