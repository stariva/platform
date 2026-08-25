import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { BreadcrumbJsonLd, PersonJsonLd } from "@/components/stariva/json-ld";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://stariva.ru";

export const metadata: Metadata = {
  title: "О бренде Stariva — мастерская ручного макраме",
  description:
    "История Stariva — московской мастерской ручного макраме. Ольга Карпычева создаёт абажуры, одежду и декор из натурального хлопка с 2018 года.",
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    type: "profile",
    title: "О бренде Stariva — мастерская ручного макраме",
    description:
      "История Stariva — московской мастерской ручного макраме. Ольга Карпычева создаёт абажуры, одежду и декор из натурального хлопка с 2018 года.",
    url: `${BASE_URL}/about`,
    images: [
      {
        url: `${BASE_URL}/images/about/hero-founder.jpg`,
        width: 1200,
        height: 800,
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
    title: "Мастерство, а не производство",
    body: "У меня нет конвейера. Каждый узел завязываю я сама — с именем, историей и любовью к своему делу.",
  },
];

const timeline = [
  {
    year: "2018",
    event: "Основание",
    detail:
      "Ольга Карпычева начинает плести макраме на кухне. Первые абажуры уходят к подругам.",
  },
  {
    year: "2019",
    event: "Первая мастерская",
    detail:
      "Первые заказы через соцсети. Обустраиваю домашнюю мастерскую и начинаю работать на постоянной основе.",
  },
  {
    year: "2021",
    event: "Выход на Ozon",
    detail:
      "Первые 100 заказов через маркетплейс. Бренд начинает получать признание по всей России.",
  },
  {
    year: "2023",
    event: "Собственное ателье",
    detail:
      "Расширение ассортимента: запуск линейки одежды и обучающих мастер-классов.",
  },
  {
    year: "2025",
    event: "Сегодня",
    detail:
      "Более 500 изделий по всей России. Три направления: одежда, интерьер, декор. Каждое изделие — ручная работа одного мастера.",
  },
];

const stats = [
  { value: "500+", label: "изделий\nсоздано" },
  { value: "1", label: "мастер\nодного" },
  { value: "7", label: "лет\nопыта" },
  { value: "47", label: "регионов\nРоссии" },
];

export default function AboutPage() {
  return (
    <div className="bg-parchment text-espresso">
      <Header variant="solid" />
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "О бренде", href: "/about" },
        ]}
      />
      <PersonJsonLd />

      {/* ── Hero ── */}
      <section className="relative min-h-[90vh] flex items-end overflow-hidden">
        {/* Full-bleed image */}
        <div className="absolute inset-0">
          <Image
            src="/images/about/hero-founder.jpg"
            alt="Ольга Карпычева в мастерской"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          {/* Bottom-up gradient for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-espresso/80 via-espresso/20 to-transparent" />
          {/* Top thin gradient to blend with header */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-espresso/30 to-transparent" />
        </div>

        {/* Content pinned to bottom */}
        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-6 lg:px-14 pb-16 lg:pb-24 pt-[100px]">
          <div className="max-w-3xl">
            <p className="label-caps text-linen/70 mb-5 tracking-widest">
              О бренде
            </p>
            <h1 className="font-serif text-white text-[clamp(3rem,7vw,6.5rem)] leading-[0.95] tracking-tight text-balance">
              Сделано руками.
              <br />
              <em className="not-italic text-linen">Согрето душой.</em>
            </h1>
            <p className="mt-8 text-white/75 text-lg lg:text-xl max-w-xl leading-[1.75]">
              Stariva — мастер ручного макраме из Подмосковья. Я создаю одежду,
              интерьерные предметы и декор из натурального хлопка с 2018 года.
            </p>
          </div>

          {/* Stats row */}
          <div className="mt-14 flex flex-wrap gap-px border border-white/10 rounded-xl overflow-hidden w-fit">
            {stats.map((s, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: stats are static and never reordered
                key={i}
                className="px-8 py-5 bg-white/8 backdrop-blur-sm flex flex-col gap-1 min-w-[110px]"
              >
                <span className="font-serif text-3xl lg:text-4xl text-white leading-none">
                  {s.value}
                </span>
                <span className="label-caps text-white/50 text-[10px] leading-tight whitespace-pre">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Philosophy statement ── */}
      <section className="py-28 lg:py-40">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">
            <div className="lg:col-span-4">
              <p className="label-caps text-terracotta tracking-widest mb-4">
                Философия
              </p>
              <div className="h-px bg-espresso/12 w-12" />
            </div>
            <div className="lg:col-span-8">
              <blockquote className="font-serif text-[clamp(1.8rem,4vw,3.2rem)] leading-[1.15] text-espresso text-balance">
                &ldquo;Я верю, что вещи должны создаваться медленно — с
                намерением, вниманием и уважением к материалу. Каждый узел — это
                выбор. Каждое изделие — это история.&rdquo;
              </blockquote>
              <p className="mt-8 text-taupe text-sm label-caps tracking-widest">
                — Ольга Карпычева, мастер
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Atelier image full-bleed ── */}
      <section className="relative aspect-[16/7] overflow-hidden">
        <Image
          src="/images/about/atelier-wide.jpg"
          alt="Мастерская Stariva"
          fill
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-espresso/10" />
        <div className="absolute bottom-8 right-8 lg:bottom-12 lg:right-14">
          <span className="label-caps text-white/60 text-[10px] tracking-widest">
            Мастерская Stariva
          </span>
        </div>
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
                Что меня
                <br />
                определяет
              </h2>
            </div>
            <p className="text-taupe text-base leading-[1.8] max-w-sm lg:text-right">
              Четыре принципа, которым я не изменяю с первого дня и которые
              лежат в основе каждого изделия.
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
                  src="/images/about/hands-knotting.jpg"
                  alt="Руки мастерицы, завязывающей узлы макраме"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 50vw, 25vw"
                />
              </div>
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden col-span-1 mt-12">
                <Image
                  src="/images/about/cotton-spools.jpg"
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
                  300 метров верёвки. Это не быстро. Зато навсегда.
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
                    className="label-caps text-[10px] px-4 py-2 rounded-full border-espresso/15 text-taupe tracking-widest"
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
                  <p className="text-parchment/55 text-[14px] leading-[1.8] lg:max-w-xl">
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
          src="/images/about/finished-pieces.jpg"
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
