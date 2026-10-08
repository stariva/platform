import Image from "next/image";
import Link from "next/link";
import { type Scenario, scenarios } from "../_data";

function ScenarioBlock({
  scenario,
  index,
}: {
  scenario: Scenario;
  index: number;
}) {
  const reversed = index % 2 === 1;
  return (
    <article
      id={scenario.id}
      className="scroll-mt-24 py-16 lg:py-24 border-t border-espresso/10 first:border-t-0"
    >
      <div
        className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${reversed ? "lg:[&>*:first-child]:order-2" : ""}`}
      >
        <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-sand">
          <Image
            src={scenario.image}
            alt={scenario.imageAlt}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
          <span className="absolute top-5 left-5 rounded-full bg-parchment/90 px-4 py-1.5 label-caps text-[11px] text-espresso backdrop-blur-sm">
            {String(index + 1).padStart(2, "0")} · {scenario.label}
          </span>
        </div>

        <div>
          <p className="label-caps text-terracotta text-[11px] mb-4">
            {scenario.places}
          </p>
          <h3
            className="font-serif text-near-black leading-[1.1] mb-5 text-balance"
            style={{ fontSize: "clamp(28px, 3.5vw, 44px)" }}
          >
            {scenario.title}
          </h3>
          <p className="text-dark-grey leading-relaxed mb-6 max-w-lg">
            {scenario.description}
          </p>
          <ul className="space-y-2 mb-10">
            {scenario.tips.map((tip) => (
              <li key={tip} className="flex gap-3 text-[14px] text-espresso">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta"
                />
                {tip}
              </li>
            ))}
          </ul>

          <p className="label-caps text-taupe text-[11px] mb-4">
            Образы для этой локации
          </p>
          <ul className="grid grid-cols-3 gap-3 lg:gap-4">
            {scenario.looks.map((look) => (
              <li key={look.href}>
                <Link href={look.href} className="group block">
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-sand">
                    <Image
                      src={look.image}
                      alt={look.name}
                      fill
                      sizes="(min-width: 1024px) 15vw, 33vw"
                      className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-2 text-[12px] lg:text-[13px] leading-snug text-espresso group-hover:text-terracotta transition-colors">
                    {look.name}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

export function PhotoshootsScenarios() {
  return (
    <section
      id="scenarios"
      className="scroll-mt-20 py-20 lg:py-28 bg-parchment"
    >
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
        <div className="max-w-2xl mb-6">
          <p className="label-caps text-terracotta text-[11px] mb-4">
            Локации и образы
          </p>
          <h2
            className="font-serif text-near-black leading-[1.1] text-balance"
            style={{ fontSize: "clamp(30px, 4vw, 52px)" }}
          >
            Куда вы едете — такое и платье
          </h2>
          <p className="mt-5 text-dark-grey leading-relaxed">
            Мы собрали самые популярные сценарии съёмок наших клиенток и
            подобрали к каждому модели из каталога. Любую можно сплести в другом
            цвете и по вашим меркам.
          </p>
        </div>

        {scenarios.map((scenario, i) => (
          <ScenarioBlock key={scenario.id} scenario={scenario} index={i} />
        ))}
      </div>
    </section>
  );
}
