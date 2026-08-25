import Image from "next/image";
import { scenarios } from "../_data";

export function ResortScenarios() {
  return (
    <section className="py-24 lg:py-36 bg-parchment">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
        <div className="mb-14">
          <p className="label-caps text-terracotta text-[10px] mb-4">
            Где используется
          </p>
          <h2
            className="font-serif text-near-black leading-tight max-w-xl"
            style={{ fontSize: "clamp(28px, 4vw, 48px)" }}
          >
            Для каждого пространства — своё решение
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
                <div className="absolute inset-0 bg-gradient-to-t from-near-black/40 to-transparent" />
                <div className="absolute bottom-4 left-5 flex flex-wrap gap-1.5">
                  {s.tags.map((t) => (
                    <span
                      key={t}
                      className="label-caps text-[9px] text-white bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/25"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-6">
                <h3 className="font-serif text-near-black text-xl mb-3">
                  {s.title}
                </h3>
                <p className="text-dark-grey leading-relaxed text-[14px]">
                  {s.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
