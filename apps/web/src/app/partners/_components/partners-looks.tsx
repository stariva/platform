import Image from "next/image";
import Link from "next/link";
import { IN_STOCK_HREF } from "@/lib/in-stock";
import { features, moodLooks } from "../_data";

export function PartnersLooks() {
  return (
    <section className="py-20 lg:py-28 bg-off-white">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-12 lg:gap-20">
          <div>
            <p className="label-caps text-terracotta text-[11px] mb-4">
              Почему макраме в кадре
            </p>
            <h2
              className="font-serif text-near-black leading-[1.1] text-balance mb-10"
              style={{ fontSize: "clamp(28px, 3.5vw, 44px)" }}
            >
              Платье, которое работает на кадр
            </h2>
            <dl className="grid sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-7">
              {features.map((f) => (
                <div key={f.title}>
                  <dt className="font-serif text-near-black text-[18px] mb-2">
                    {f.title}
                  </dt>
                  <dd className="text-dark-grey text-[14px] leading-relaxed">
                    {f.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <div className="flex items-end justify-between gap-4 mb-5">
              <p className="label-caps text-taupe text-[11px]">
                Подборка для съёмок
              </p>
              <Link
                href="/photoshoots"
                className="text-[13px] text-espresso underline-offset-4 hover:text-terracotta hover:underline transition-colors"
              >
                Образы по локациям →
              </Link>
            </div>
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
              {moodLooks.map((look) => (
                <li key={look.href}>
                  <Link href={look.href} className="group block">
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-sand">
                      <Image
                        src={look.image}
                        alt={look.name}
                        fill
                        sizes="(min-width: 1024px) 14vw, (min-width: 640px) 25vw, 50vw"
                        className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      />
                      <span className="absolute top-2 left-2 rounded-full bg-parchment/90 px-2.5 py-0.5 label-caps text-[10px] text-espresso backdrop-blur-sm">
                        {look.mood}
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] lg:text-[13px] leading-snug text-espresso group-hover:text-terracotta transition-colors">
                      {look.name}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/catalog/clothes"
                className="inline-flex items-center border border-espresso/20 text-espresso px-6 py-3 rounded-full label-caps-md hover:bg-espresso hover:text-parchment transition-colors"
              >
                Весь каталог одежды
              </Link>
              <Link
                href={IN_STOCK_HREF}
                className="inline-flex items-center border border-espresso/20 text-espresso px-6 py-3 rounded-full label-caps-md hover:bg-espresso hover:text-parchment transition-colors"
              >
                Готовые в наличии
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
