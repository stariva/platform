import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <section
      id="intro"
      aria-labelledby="hero-title"
      className="bg-[#eee8dc] pt-[72px] lg:pt-20"
    >
      <div className="relative isolate overflow-hidden lg:min-h-[660px] lg:h-[min(780px,calc(100svh-80px))]">
        <div className="relative h-[320px] min-[390px]:h-[350px] sm:h-[480px] lg:absolute lg:inset-0 lg:h-auto">
          <div className="absolute inset-y-0 -left-[40%] right-0 lg:left-0">
            <Image
              src="/images/home/hero-fashion-v2.webp"
              alt="Две модели в молочном платье и песочной тунике с фактурным плетением макраме"
              fill
              preload
              sizes="(max-width: 1023px) 140vw, 100vw"
              className="object-cover object-top"
            />
          </div>
          <div
            aria-hidden="true"
            className="hidden lg:block absolute inset-0 bg-linear-to-r from-[#eee8dc]/40 via-transparent to-transparent"
          />
        </div>
        <div className="relative mx-auto flex max-w-[1600px] flex-col justify-center px-6 pt-7 pb-9 sm:px-10 lg:min-h-[660px] lg:h-full lg:px-[5%] lg:py-16">
          <div className="lg:w-[43%]">
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.22em] text-espresso/75">
              Одежда макраме · ручная работа
            </p>
            <h1
              id="hero-title"
              className="mt-3 font-serif text-[52px] sm:text-7xl lg:text-[clamp(72px,7.2vw,108px)] leading-[0.94] tracking-[-0.035em] text-espresso"
            >
              Сплетено
              <br />
              <span className="italic">для вас.</span>
            </h1>
            <p className="mt-4 lg:mt-7 max-w-[340px] text-sm sm:text-base leading-relaxed text-espresso/80">
              Платья, топы и туники по вашим меркам.
              <br className="hidden sm:block" /> Вы выбираете образ — мы плетём
              вручную.
            </p>
            <div className="mt-6 lg:mt-8 flex flex-col items-start gap-3 lg:gap-4">
              <Link
                href="#order"
                data-location="hero"
                className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-4 rounded-full bg-espresso px-5 py-3.5 text-[13px] sm:text-sm font-medium text-parchment transition-[background-color,transform] duration-150 hover:bg-dark-grey active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-espresso"
              >
                Заказать по своим меркам <span aria-hidden="true">↗</span>
              </Link>
              <Link
                href="/catalog/clothes"
                className="inline-flex min-h-10 items-center gap-3 text-sm text-espresso underline decoration-espresso/40 underline-offset-4 hover:decoration-espresso"
              >
                Посмотреть одежду <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <p className="mt-3 lg:mt-6 text-xs leading-relaxed text-espresso/65">
              Поможем с мерками. Цену и срок согласуем заранее.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
