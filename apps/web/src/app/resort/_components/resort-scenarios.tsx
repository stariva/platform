import Image from "next/image";
import { scenarios } from "../_data";

export function ResortScenarios() {
  return (
    <section className="py-24 lg:py-36 bg-parchment">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
        <div className="mb-14">
          <p className="label-caps text-terracotta text-[11px] mb-4">
            Где повесить
          </p>
          <h2
            className="font-serif text-near-black leading-tight max-w-xl"
            style={{ fontSize: "clamp(28px, 4vw, 48px)" }}
          >
            Что заказывают базы отдыха
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {scenarios.map((s) => (
            <article
              key={s.title}
              className="group rounded-2xl overflow-hidden border border-espresso/8 hover:border-espresso/20 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(22,21,19,0.08)] bg-white"
            >
              <div className="relative h-60 overflow-hidden">
                <Image
                  src={s.image}
                  alt={s.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
              <div className="p-6">
                <h3 className="font-serif text-near-black text-xl mb-3">
                  {s.title}
                </h3>
                <p className="text-dark-grey leading-relaxed text-[14px] mb-5">
                  {s.body}
                </p>
                <ul className="space-y-2.5 pt-5 border-t border-espresso/8">
                  {s.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-3 text-espresso/70 text-sm"
                    >
                      <span className="w-1 h-1 rounded-full bg-espresso/30 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
