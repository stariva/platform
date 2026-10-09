import Image from "next/image";
import { ORDER_DEADLINE_LABEL } from "../_data";
import { NewYearCountdown } from "./new-year-countdown";
import { TrackedLink } from "./tracked-link";

const facts = [
  { value: "2–4 дня", label: "плетём под заказ" },
  { value: "100%", label: "хлопковый шнур" },
  { value: "по РФ", label: "доставка" },
];

export function ElkaHero() {
  return (
    <section className="bg-parchment">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 pt-28 lg:pt-36 pb-16 lg:pb-24 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-16 items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-sage-pale text-espresso px-4 py-2 text-sm mb-6">
            <span className="size-2 rounded-full bg-terracotta" aria-hidden />
            До Нового года <NewYearCountdown />
          </p>

          <h1
            className="font-serif text-espresso leading-[1.08] text-balance mb-6"
            style={{ fontSize: "clamp(36px, 5.4vw, 68px)" }}
          >
            Макраме-ёлка на стену — новогодний декор ручной работы
          </h1>

          <p className="text-lg text-dark-grey leading-relaxed max-w-xl mb-8 text-pretty">
            Не осыпается, не занимает места и служит годами. Подходит для
            квартиры и детской, лобби отеля, ресторана, салона и офиса. Закажите
            готовую ёлку или сплетите её сами на мастер-классе.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <TrackedLink
              href="#models"
              goal="elka_hero_models"
              className="inline-flex items-center justify-center rounded-2xl bg-terracotta hover:bg-terracotta-dark text-parchment px-8 py-4 text-base transition-colors"
            >
              Выбрать ёлку
            </TrackedLink>
            <TrackedLink
              href="#workshop"
              goal="elka_hero_workshop"
              className="inline-flex items-center justify-center rounded-2xl border border-espresso/20 hover:border-espresso text-espresso px-8 py-4 text-base transition-colors"
            >
              Мастер-класс со скидкой
            </TrackedLink>
          </div>

          <dl className="grid grid-cols-3 gap-4 max-w-md border-t border-espresso/10 pt-6">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="sr-only">{fact.label}</dt>
                <dd className="font-serif text-2xl text-espresso">
                  {fact.value}
                </dd>
                <dd className="text-sm text-text-grey">{fact.label}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-text-grey mt-6">
            Закажите до {ORDER_DEADLINE_LABEL} — успеем сплести и доставить к
            празднику.
          </p>
        </div>

        <div className="relative aspect-[4/5] rounded-[28px] overflow-hidden bg-linen">
          <Image
            src="/images/elka/hero.png"
            alt="Ёлка-панно в технике макраме с гирляндой над деревянным комодом в скандинавской гостиной"
            fill
            priority
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
