import Image from "next/image";
import { NewYearCountdown } from "@/app/elka-makrame/_components/new-year-countdown";
import { TrackedLink } from "@/app/elka-makrame/_components/tracked-link";
import { LANDING_PATH, ORDER_DEADLINE_LABEL } from "@/app/elka-makrame/_data";

const points = [
  "Не осыпается и не занимает места на полу",
  "Для квартиры, детской, отеля, кафе и офиса",
  "Плетём под заказ за 2–4 дня, доставка по России",
];

const models = [
  {
    image: "/images/elka/model-cream.png",
    alt: "Бежевая ёлка-панно из макраме на стене",
    label: "Бежевая · 70–75 × 150 см",
  },
  {
    image: "/images/elka/model-khaki.png",
    alt: "Ёлка-панно из макраме цвета хаки",
    label: "Хаки · 45 × 100 см",
  },
];

export function ElkaTeaser() {
  return (
    <section
      aria-labelledby="elka-teaser-title"
      className="bg-sand py-14 lg:py-24"
    >
      <div className="max-w-[1400px] mx-auto px-5 lg:px-10 grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-sage-pale text-espresso px-4 py-2 text-sm mb-5">
            <span className="size-2 rounded-full bg-terracotta" aria-hidden />
            До Нового года <NewYearCountdown />
          </p>
          <h2
            id="elka-teaser-title"
            className="font-serif text-4xl lg:text-5xl leading-tight"
          >
            Новогодняя ёлка
            <br />
            <span className="italic">из макраме на стену</span>
          </h2>
          <p className="mt-4 max-w-xl text-espresso/70 leading-relaxed">
            Вместо живой ели — панно ручной работы, которое служит годами.
            Выберите готовую ёлку или сплетите её сами на онлайн-мастер-классе.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-espresso/80">
            {points.map((point) => (
              <li key={point} className="flex gap-3">
                <span
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-terracotta"
                  aria-hidden
                />
                {point}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <TrackedLink
              href={`${LANDING_PATH}#models`}
              goal="home_elka_models"
              className="inline-flex items-center justify-center rounded-full bg-espresso text-parchment px-6 py-3 text-sm"
            >
              Выбрать ёлку ↗
            </TrackedLink>
            <TrackedLink
              href={`${LANDING_PATH}#workshop`}
              goal="home_elka_workshop"
              className="inline-flex items-center justify-center rounded-full border border-espresso/25 hover:border-espresso text-espresso px-6 py-3 text-sm transition-colors"
            >
              Мастер-класс со скидкой
            </TrackedLink>
          </div>
          <p className="mt-4 text-xs text-taupe">
            Закажите до {ORDER_DEADLINE_LABEL} — успеем сплести и доставить к
            празднику.
          </p>
        </div>

        <ul className="grid grid-cols-2 gap-3 lg:gap-5">
          {models.map((model, index) => (
            <li
              key={model.image}
              className={index === 1 ? "mt-8 lg:mt-12" : ""}
            >
              <TrackedLink
                href={`${LANDING_PATH}#models`}
                goal="home_elka_image"
                className="group relative block aspect-[4/5] overflow-hidden rounded-xl bg-linen"
              >
                <Image
                  src={model.image}
                  alt={model.alt}
                  fill
                  sizes="(min-width: 1024px) 28vw, 45vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-espresso/60 via-transparent to-transparent" />
                <span className="absolute left-4 bottom-4 right-4 text-sm text-parchment">
                  {model.label}
                </span>
              </TrackedLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
