import Image from "next/image";
import Link from "next/link";
import { homePortfolio } from "@/lib/home-portfolio";

export function Hero() {
  return (
    <section id="intro" className="bg-parchment pt-24 pb-10 lg:pt-32 lg:pb-16">
      <div className="max-w-[1400px] mx-auto px-5 lg:px-10 grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
        <div className="py-3 lg:py-8">
          <p className="label-caps text-terracotta mb-5">
            Stariva · мастерская Ольги Карпычевой
          </p>
          <h1 className="font-serif text-[clamp(2.8rem,6vw,5.8rem)] leading-[1.02] tracking-tight text-espresso text-balance">
            Макраме{" "}
            <span className="italic text-terracotta">по вашим размерам</span>
          </h1>
          <p className="mt-5 max-w-lg text-base lg:text-lg text-espresso/75 leading-relaxed">
            Абажуры, одежда и декор ручной работы. Подберём размер, цвет и
            плетение под вашу задумку — от первого эскиза до готового изделия.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Link
              href="#order"
              data-location="hero"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-terracotta text-parchment px-7 py-3 text-sm font-medium transition-colors hover:bg-espresso active:scale-[0.98]"
            >
              Получить расчёт от мастера{" "}
              <span aria-hidden="true" className="ml-3">
                ↗
              </span>
            </Link>
            <Link
              href="#examples"
              className="py-3 text-sm text-espresso underline underline-offset-4"
            >
              Посмотреть изделия
            </Link>
          </div>
          <p className="mt-4 text-sm text-taupe">
            Можно начать с идеи или фото. С замерами поможем.
          </p>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 border-t border-espresso/10 pt-5 text-xs text-espresso/70">
            <span>Ручная работа с 2018 года</span>
            <span>Цена и срок — до начала работы</span>
          </div>
        </div>
        <figure className="relative overflow-hidden rounded-2xl bg-sand">
          <div className="relative aspect-[4/3] lg:aspect-[4/5] max-h-[620px]">
            <Image
              src={homePortfolio[0].image}
              alt={homePortfolio[0].name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <figcaption className="px-5 py-4 flex items-center justify-between gap-3 text-sm text-espresso">
            <span>Абажур из каталога Stariva</span>
            <Link
              href={homePortfolio[0].href}
              className="underline underline-offset-4 shrink-0"
            >
              О модели ↗
            </Link>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
