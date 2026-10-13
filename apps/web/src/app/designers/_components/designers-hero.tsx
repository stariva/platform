import Image from "next/image";
import { DESIGNER_DISCOUNTS } from "@/lib/designers/brief";

const [baseTier, volumeTier] = DESIGNER_DISCOUNTS;

const facts = [
  { value: `${baseTier.percent}%`, label: "скидка\nс первого изделия" },
  {
    value: `${volumeTier.percent}%`,
    label: `от ${volumeTier.minItems} изделий\nв проекте`,
  },
  { value: "2 дня", label: "расчёт\nдля сметы" },
];

export function DesignersHero() {
  return (
    <section className="relative min-h-[88vh] flex items-end overflow-hidden bg-espresso">
      <div className="absolute inset-x-0 top-0 h-[480px] md:h-full">
        <Image
          src="https://cdn.stariva.ru/site/images/b2b/project-restaurant-editorial.webp"
          alt="Пример решения: плетёная перегородка из хлопка рядом с сервированным столом ресторана"
          fill
          priority
          unoptimized
          className="object-cover object-[60%_center]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-espresso via-espresso/15 to-transparent md:from-espresso/90 md:via-espresso/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-espresso/20 to-transparent md:from-espresso/60 md:via-espresso/15" />
      </div>

      <div className="relative z-10 w-full max-w-[1440px] mx-auto px-6 lg:px-14 pb-16 lg:pb-24 pt-[280px] md:pt-[100px]">
        <div className="max-w-3xl">
          <p className="label-caps text-linen/60 mb-5 tracking-widest">
            Дизайнерам интерьера
          </p>
          <h1 className="font-serif text-white text-[clamp(2.75rem,6vw,5.5rem)] leading-[0.98] tracking-tight text-balance">
            Макраме под ваш проект —
            <br />
            <em className="not-italic text-linen">на условиях партнёра</em>
          </h1>
          <p className="mt-8 text-white/75 text-lg lg:text-xl max-w-xl leading-[1.75]">
            Абажуры, панно и перегородки ручного плетения для кафе, ресторанов и
            отелей. Размер, цвет и узор под концепцию, скидка дизайнера с
            первого изделия и расчёт для сметы за 2 рабочих дня.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="#brief"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white text-espresso label-caps-md hover:bg-linen transition-colors duration-300"
            >
              Собрать бриф проекта
            </a>
            <a
              href="#terms"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full border border-white/30 text-white label-caps-md hover:border-white/60 transition-colors duration-300"
            >
              Условия для дизайнеров
            </a>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap gap-px border border-white/10 rounded-xl overflow-hidden w-fit">
          {facts.map((fact) => (
            <div
              key={fact.value}
              className="px-7 py-5 bg-white/8 backdrop-blur-sm flex flex-col gap-1 min-w-[120px]"
            >
              <span className="font-serif text-3xl lg:text-4xl text-white leading-none">
                {fact.value}
              </span>
              <span className="label-caps text-white/75 text-[11px] leading-tight whitespace-pre">
                {fact.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
