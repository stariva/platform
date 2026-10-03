import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { BreadcrumbJsonLd, PersonJsonLd } from "@/components/stariva/json-ld";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SITE_URL as BASE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Обо мне — Ольга Карпычева, мастер макраме",
  description:
    "Меня зовут Ольга Карпычева. С 2018 года я плету макраме дома в Подмосковье — абажуры, одежду и декор из натурального хлопка.",
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    type: "profile",
    title: "Обо мне — Ольга Карпычева, мастер макраме",
    description:
      "Меня зовут Ольга Карпычева. С 2018 года я плету макраме дома в Подмосковье — абажуры, одежду и декор из натурального хлопка.",
    url: `${BASE_URL}/about`,
    images: [
      {
        url: `https://cdn.stariva.ru/site/images/about/founder-2026-editorial.webp`,
        width: 1536,
        height: 1024,
        alt: "Ольга Карпычева — мастер Stariva",
      },
    ],
  },
};

const values = [
  {
    number: "01",
    title: "Медленная мода",
    body: "Я против быстрой моды. Каждое изделие создаётся неделями — и служит годами. Покупать меньше, но лучше.",
  },
  {
    number: "02",
    title: "100% натуральный хлопок",
    body: "Только хлопковые верёвки без синтетики, без химических красителей. Экологично — для вас и для планеты.",
  },
  {
    number: "03",
    title: "Уникальность каждого изделия",
    body: "Ни одно изделие не повторяется в точности. Ручная работа — это неизбежные и прекрасные отличия.",
  },
  {
    number: "04",
    title: "Всё делаю сама",
    body: "Я работаю одна, без помощников и производства. Каждый узел в каждой вещи завязываю своими руками.",
  },
];

const timeline = [
  {
    year: "2018",
    event: "Первые узлы",
    detail:
      "Начала плести макраме дома, на кухне, просто для себя. Первые абажуры раздарила подругам.",
  },
  {
    year: "2019",
    event: "Первые заказы",
    detail:
      "Стали писать знакомые знакомых — так появились первые заказы через соцсети. Обустроила дома рабочий уголок.",
  },
  {
    year: "2024",
    event: "Магазин на Ozon",
    detail:
      "Открыла магазин на Ozon, чтобы изделия можно было заказать из любого города.",
  },
  {
    year: "2026",
    event: "Сейчас",
    detail:
      "Плету одежду, абажуры и декор, иногда провожу мастер-классы. По-прежнему всё — сама и по одному изделию.",
  },
];

const stats = [
  { value: "2018", label: "плету\nс этого года" },
  { value: "1", label: "мастер —\nвсё сама" },
  { value: "100%", label: "натуральный\nхлопок" },
];

export default function AboutPage() {
  return (
    <div className="bg-parchment text-espresso">
      <Header variant="solid" />
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Обо мне", href: "/about" },
        ]}
      />
      <PersonJsonLd />

      {/* ── Hero ── */}
      {/*
        Mobile: full-bleed photo, white copy over a dark gradient.
        Desktop: the photo is a 3:2 panel on the right that never grows past
        its native height (so it is neither upscaled nor cropped top/bottom),
        washed into a wall-coloured field on the left that carries dark copy.
      */}
      <section className="relative min-h-[90vh] flex items-end overflow-hidden lg:items-center lg:bg-linen lg:[--hero-h:clamp(640px,90vh,1080px)] lg:min-h-(--hero-h)">
        <div className="absolute inset-0 lg:left-auto lg:w-[min(66%,calc(var(--hero-h)*1.5))]">
          <Image
            src="https://cdn.stariva.ru/site/images/about/founder-2026-editorial.webp"
            alt="Ольга Карпычева за работой"
            fill
            priority
            unoptimized
            className="object-cover object-[56%_center] lg:object-[70%_center]"
            sizes="(min-width: 1024px) 66vw, 100vw"
          />
          {/* Mobile: bottom-up gradient for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-espresso/90 via-espresso/45 to-transparent lg:hidden" />
          {/* Mobile: top thin gradient to blend with header */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-espresso/30 to-transparent lg:hidden" />
          {/* Desktop: dissolve the photo's left edge into the wall-coloured field.
              Starts a few px outside the photo so the two antialiased edges
              never coincide — at fractional DPR they'd leave a dark hairline. */}
          <div className="absolute inset-y-0 -left-1 hidden w-1/2 fade-linen-x lg:block" />
        </div>

        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-6 lg:px-14 pb-16 pt-[400px] sm:pt-[480px] lg:py-20">
          <div className="max-w-3xl">
            <p className="label-caps text-linen/70 mb-5 tracking-widest lg:text-taupe">
              Обо мне
            </p>
            <h1 className="font-serif text-white text-[clamp(3rem,7vw,6.5rem)] leading-[0.95] tracking-tight text-balance lg:text-espresso">
              Сделано руками.
              <br />
              <em className="not-italic text-linen lg:text-taupe">
                Согрето душой.
              </em>
            </h1>
            <p className="mt-8 text-white/75 text-lg lg:text-xl max-w-xl leading-[1.75] lg:max-w-md xl:max-w-lg lg:text-espresso/75">
              Меня зовут Ольга Карпычева. Я плету макраме дома, в Подмосковье, —
              одежду, абажуры и небольшой декор из натурального хлопка.
            </p>
          </div>

          {/* Stats row */}
          <div className="mt-14 flex flex-wrap gap-px border border-white/10 rounded-xl overflow-hidden w-fit lg:border-espresso/10 lg:bg-espresso/10">
            {stats.map((s, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: stats are static and never reordered
                key={i}
                className="px-8 py-5 bg-white/8 backdrop-blur-sm flex flex-col gap-1 min-w-[110px] lg:bg-parchment/70"
              >
                <span className="font-serif text-3xl lg:text-4xl text-white leading-none lg:text-espresso">
                  {s.value}
                </span>
                <span className="label-caps text-white/75 text-[11px] leading-tight whitespace-pre lg:text-taupe">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About me ── */}
      <section className="py-28 lg:py-40">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">
            <div className="lg:col-span-4">
              <p className="label-caps text-terracotta tracking-widest mb-4">
                Обо мне
              </p>
              <div className="h-px bg-espresso/12 w-12" />
            </div>
            <div className="lg:col-span-8 max-w-3xl">
              <p className="font-serif text-[clamp(1.6rem,3vw,2.4rem)] leading-[1.25] text-espresso text-balance">
                Макраме для меня началось как увлечение — и до сих пор им
                остаётся, просто теперь мои вещи живут не только у меня дома.
              </p>
              <div className="mt-10 space-y-5 text-espresso/75 text-[15px] leading-[1.85]">
                <p>
                  В 2018 году я начала плести на кухне, для себя. Первые абажуры
                  раздарила подругам, потом стали писать их знакомые — так
                  понемногу появились заказы.
                </p>
                <p>
                  Я работаю одна, дома в Подмосковье. Каждое изделие делаю от
                  первого до последнего узла сама, поэтому вещей немного, а
                  работу на заказ иногда приходится подождать.
                </p>
                <p>
                  С 2024 года мои изделия можно найти на Ozon. А здесь, на
                  сайте, можно ещё заказать вещь по своим меркам или прийти ко
                  мне на мастер-класс.
                </p>
              </div>
              <p className="mt-8 text-taupe text-sm label-caps tracking-widest">
                — Ольга Карпычева
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Workspace image full-bleed ── */}
      <section className="relative aspect-[16/7] overflow-hidden">
        <Image
          src="https://cdn.stariva.ru/site/images/about/atelier-wide-editorial.webp"
          alt="Рабочее место Stariva"
          fill
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-espresso/10" />
      </section>

      {/* ── Brand values ── */}
      <section className="py-28 lg:py-40 bg-sand">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
          <div className="mb-16 lg:mb-20 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <p className="label-caps text-terracotta tracking-widest mb-4">
                Ценности
              </p>
              <h2 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-espresso leading-[1.05]">
                Как я
                <br />
                работаю
              </h2>
            </div>
            <p className="text-taupe text-base leading-[1.8] max-w-sm lg:text-right">
              Несколько простых вещей, которых я стараюсь держаться в каждой
              работе.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-espresso/8 border border-espresso/8 rounded-2xl overflow-hidden">
            {values.map((v) => (
              <div
                key={v.number}
                className="bg-sand p-10 lg:p-14 flex flex-col gap-5"
              >
                <span className="font-serif text-5xl text-espresso/12 leading-none select-none">
                  {v.number}
                </span>
                <h3 className="font-serif text-2xl lg:text-3xl text-espresso leading-tight">
                  {v.title}
                </h3>
                <p className="text-taupe leading-[1.8] text-[15px]">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Craftsmanship — two-column image + text ── */}
      <section className="py-28 lg:py-40">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            {/* Images */}
            <div className="grid grid-cols-2 gap-4">
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden col-span-1">
                <Image
                  src="https://cdn.stariva.ru/site/images/about/hands-knotting-editorial.webp"
                  alt="Руки мастерицы, завязывающей узлы макраме"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 50vw, 25vw"
                />
              </div>
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden col-span-1 mt-12">
                <Image
                  src="https://cdn.stariva.ru/site/images/about/cotton-spools-editorial.webp"
                  alt="Катушки натурального хлопкового шнура"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 50vw, 25vw"
                />
              </div>
            </div>

            {/* Text */}
            <div>
              <p className="label-caps text-terracotta tracking-widest mb-6">
                Мастерство
              </p>
              <h2 className="font-serif text-[clamp(2.2rem,4vw,3.8rem)] text-espresso leading-[1.1] mb-8">
                Искусство узла
              </h2>
              <div className="space-y-5 text-espresso/75 text-[15px] leading-[1.85]">
                <p>
                  Основа макраме — квадратный узел. Из этого простого элемента,
                  повторённого сотни и тысячи раз, вырастают сложнейшие кружева
                  абажуров, геометрия настенных панно и лёгкость пляжного
                  платья.
                </p>
                <p>
                  Я использую только натуральный хлопковый шнур: крученый для
                  плотных конструкций, косичный для мягких изделий с бахромой.
                  Диаметр — от 1 до 10 мм — подбирается под каждый проект
                  индивидуально.
                </p>
                <p>
                  Один абажур диаметром 50 см требует около 40 часов работы и
                  300 метров верёвки. Это небыстро, зато вещь прослужит долго.
                </p>
              </div>

              {/* Material badges */}
              <div className="mt-10 flex flex-wrap gap-3">
                {[
                  "100% хлопок",
                  "Без красителей",
                  "Проверено временем",
                  "Ручная работа",
                ].map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="label-caps text-[11px] px-4 py-2 rounded-full border-espresso/15 text-taupe tracking-widest"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Timeline / Heritage ── */}
      <section className="py-28 lg:py-40 bg-espresso text-parchment">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
          <div className="mb-16 lg:mb-20">
            <p className="label-caps text-linen/50 tracking-widest mb-4">
              История
            </p>
            <h2 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-parchment leading-[1.05]">
              Как всё начиналось
            </h2>
          </div>

          <div className="space-y-0">
            {timeline.map((item, _i) => (
              <div
                key={item.year}
                className="grid grid-cols-[64px_1fr] lg:grid-cols-[120px_1fr] gap-6 lg:gap-12 py-9 border-t border-parchment/8 group"
              >
                <div className="font-serif text-4xl lg:text-5xl text-parchment/20 group-hover:text-parchment transition-colors duration-300 leading-none pt-1">
                  {item.year}
                </div>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-12">
                  <h3 className="font-serif text-xl lg:text-2xl text-parchment">
                    {item.event}
                  </h3>
                  <p className="text-parchment/70 text-[14px] leading-[1.8] lg:max-w-xl">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
            {/* bottom border */}
            <div className="border-t border-parchment/8" />
          </div>
        </div>
      </section>

      {/* ── Finished pieces full-bleed ── */}
      <section className="relative aspect-[16/7] overflow-hidden">
        <Image
          src="https://cdn.stariva.ru/site/images/about/finished-pieces-editorial.webp"
          alt="Изделия Stariva — абажур, панно, платье"
          fill
          className="object-cover object-center"
          sizes="100vw"
        />
      </section>

      {/* ── CTA ── */}
      <section className="py-28 lg:py-40">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-14 text-center">
          <p className="label-caps text-terracotta tracking-widest mb-6">
            Начните знакомство
          </p>
          <h2 className="font-serif text-[clamp(2.8rem,6vw,5.5rem)] text-espresso leading-[1.05] text-balance max-w-3xl mx-auto mb-10">
            Найдите изделие, которое станет вашим
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              asChild
              className="inline-flex items-center gap-3 px-8 py-4 h-auto rounded-full bg-espresso text-parchment label-caps-md hover:bg-terracotta transition-colors duration-300"
            >
              <Link href="/catalog">
                Смотреть каталог
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 7h10M8 3l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="inline-flex items-center gap-3 px-8 py-4 h-auto rounded-full border-espresso/20 text-espresso label-caps-md hover:border-terracotta hover:text-terracotta transition-colors duration-300"
            >
              <Link href="/workshops">Мастер-классы</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
