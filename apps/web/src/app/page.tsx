import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CustomOrder } from "@/components/stariva/custom-order";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { Hero } from "@/components/stariva/hero";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/stariva/json-ld";
import { Marquee } from "@/components/stariva/marquee";
import { MobileStickyBar } from "@/components/stariva/mobile-sticky-bar";
import { Process } from "@/components/stariva/process";
import { Reviews } from "@/components/stariva/reviews";
import { Button } from "@/components/ui/button";
import { getFeaturedProducts } from "@/lib/ozon-service";
import { formatPrice } from "@/lib/products";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://stariva.ru";

export const metadata: Metadata = {
  alternates: { canonical: BASE_URL },
};

// ─── Homepage FAQ ─────────────────────────────────────────────────────────────
const homeFaq = [
  {
    question: "Где купить изделия Stariva?",
    answer:
      "Все изделия Stariva продаются на маркетплейсе Ozon с доставкой по всей России. Также можно оформить индивидуальный заказ напрямую через Telegram или по телефону.",
  },
  {
    question: "Из чего сделаны изделия Stariva?",
    answer:
      "Все изделия создаются из натурального хлопкового шнура без синтетических добавок и химических красителей. Хлопок экологичен, безопасен для дома и приятен на ощупь.",
  },
  {
    question: "Можно ли заказать изделие по индивидуальным размерам?",
    answer:
      "Да, мы принимаем индивидуальные заказы. Напишите в Telegram @Olga_Stariva или позвоните по номеру +7 977 872 25 46 — обсудим ваши пожелания и рассчитаем стоимость.",
  },
  {
    question: "Сколько времени занимает изготовление?",
    answer:
      "Готовые изделия отправляем в течение 1–3 дней. Изделия на индивидуальный заказ изготавливаются 7–21 день в зависимости от сложности и размера.",
  },
  {
    question: "Как ухаживать за изделиями из макраме?",
    answer:
      "Раз в неделю удаляйте пыль мягкой щёткой или феном на холодном режиме. При необходимости замочите в тёплой воде с мягким мылом на 15–20 минут, прополощите и сушите горизонтально. Не выжимайте.",
  },
  {
    question: "Есть ли мастер-классы по макраме?",
    answer:
      "Да! Мы предлагаем видео-мастер-классы по созданию абажуров, одежды и декора интерьера. Доступ навсегда, HD-видео, смотрите в своём темпе. Купить на Ozon.",
  },
];

// ─── Three-direction sections ────────────────────────────────────────────────

const directions = [
  {
    id: "clothes",
    index: "01",
    label: "Одежда",
    desc: "Платья, топы и накидки из натурального хлопка — каждое изделие создаётся вручную для вас.",
    href: "/catalog/clothes",
    accent: "text-terracotta",
    accentBg: "bg-terracotta",
    image: "/images/catalog/dress-boho-1.jpg",
    items: [
      "Платья макраме",
      "Топы и блузы",
      "Пляжные накидки",
      "Индивидуальный заказ",
    ],
  },
  {
    id: "bags",
    index: "02",
    label: "Сумки",
    desc: "Авоськи, сумки и корзины из хлопкового шнура — практичные и стильные аксессуары на каждый день.",
    href: "/catalog/bags",
    accent: "text-sage",
    accentBg: "bg-sage",
    image: "/images/catalog/category-decor.jpg",
    items: [
      "Сумки-тоут",
      "Авоськи",
      "Корзины для хранения",
      "На заказ по размеру",
    ],
  },
  {
    id: "interior",
    index: "03",
    label: "Декор интерьера",
    desc: "Абажуры, панно, плейсменты и вигвамы — детали, которые создают уют и рассказывают вашу историю.",
    href: "/catalog/interior",
    accent: "text-taupe",
    accentBg: "bg-taupe",
    image: "/images/catalog/lampshade-dome.jpg",
    items: [
      "Абажуры подвесные",
      "Настенные панно",
      "Плейсменты и подставки",
      "Детские вигвамы",
    ],
  },
];

export default async function Page() {
  const featuredProducts = await getFeaturedProducts();
  return (
    <main className="bg-parchment text-espresso">
      <BreadcrumbJsonLd items={[{ name: "Главная", href: "/" }]} />
      <Header variant="transparent" />

      {/* ── Hero: three-direction switcher ── */}
      <Hero />

      {/* ── Marquee strip ── */}
      <Marquee />

      {/* ── Three directions ── */}
      <section className="py-24 lg:py-32">
        <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
          <div className="flex items-end justify-between mb-14 lg:mb-20">
            <div>
              <span className="label-caps text-terracotta mb-3 block">
                Направления
              </span>
              <h2 className="font-serif text-4xl lg:text-6xl text-espresso leading-[1.05] text-balance">
                Три мира
                <br />
                <em className="not-italic text-taupe">одного бренда</em>
              </h2>
            </div>
            <Link
              href="/catalog"
              className="hidden lg:inline-flex items-center gap-2 label-caps-md text-espresso/60 hover:text-terracotta transition-colors"
            >
              Весь каталог
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
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-espresso/8 border border-espresso/8 rounded-xl overflow-hidden">
            {directions.map((dir) => (
              <Link
                key={dir.id}
                href={dir.href}
                className="group relative bg-parchment flex flex-col hover:bg-sand transition-colors duration-300"
              >
                {/* Image */}
                <div className="relative aspect-[4/5] overflow-hidden">
                  <Image
                    src={dir.image}
                    alt={dir.label}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 1024px) 100vw, 33vw"
                  />
                  {/* Index badge */}
                  <div className="absolute top-5 left-5">
                    <span className="label-caps text-white/70 text-[10px]">
                      {dir.index}
                    </span>
                  </div>
                </div>

                {/* Text */}
                <div className="p-6 lg:p-8 flex-1 flex flex-col">
                  <h3 className="font-serif text-3xl lg:text-4xl text-espresso mb-3 group-hover:text-terracotta transition-colors">
                    {dir.label}
                  </h3>
                  <p className="text-taupe text-sm leading-relaxed mb-6 flex-1">
                    {dir.desc}
                  </p>
                  <ul className="space-y-1.5 mb-6">
                    {dir.items.map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-2 text-espresso/60 text-[12px]"
                      >
                        <span
                          className={`w-1 h-1 rounded-full flex-shrink-0 ${dir.accentBg}`}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div
                    className={`inline-flex items-center gap-2 label-caps-md ${dir.accent} transition-all`}
                  >
                    Смотреть
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-1"
                    >
                      <path
                        d="M2 6h8M7 3l3 3-3 3"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured picks ── */}
      <section className="pb-24 lg:pb-32 bg-sand">
        <div className="max-w-[1440px] mx-auto px-5 lg:px-12 pt-16 lg:pt-24">
          <div className="flex items-end justify-between mb-12">
            <div>
              <span className="label-caps text-terracotta mb-3 block">
                Выбор редакции
              </span>
              <h2 className="font-serif text-4xl lg:text-5xl text-espresso leading-[1.05]">
                Хиты сезона
              </h2>
            </div>
            <Link
              href="/catalog"
              className="hidden lg:inline-flex items-center gap-2 label-caps-md text-espresso/60 hover:text-terracotta transition-colors"
            >
              Все товары
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
          </div>

          {featuredProducts.length > 0 ? (
            /* Grid: 2 cols on mobile, 3 on md */
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5 lg:gap-6">
              {featuredProducts.slice(0, 6).map((p) => (
                <Link
                  key={p.id}
                  href={`/catalog/${p.category}/${p.slug}`}
                  className="group"
                >
                  <div className="relative aspect-[3/4] rounded-lg overflow-hidden mb-3 bg-parchment">
                    <Image
                      src={p.images[0] ?? "/placeholder.jpg"}
                      alt={p.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="label-caps bg-parchment/90 text-espresso px-2.5 py-1 rounded-full text-[10px]">
                        {p.category === "clothes"
                          ? "Одежда"
                          : p.category === "bags"
                            ? "Сумки"
                            : "Декор интерьера"}
                      </span>
                    </div>
                  </div>
                  <h4 className="font-serif text-espresso text-lg leading-snug group-hover:text-terracotta transition-colors line-clamp-2">
                    {p.name}
                  </h4>
                  <p className="text-taupe text-sm mt-1">
                    {formatPrice(p.price, p.currency)}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-taupe">
              <p className="font-serif text-xl mb-4">Товары загружаются…</p>
              <p className="text-sm">
                Загляните в{" "}
                <Link
                  href="/catalog"
                  className="underline hover:text-terracotta"
                >
                  каталог
                </Link>{" "}
                или зайдите позже.
              </p>
            </div>
          )}

          <div className="mt-10 text-center lg:hidden">
            <Button
              asChild
              variant="outline"
              className="inline-flex items-center gap-2 label-caps-md text-espresso border-espresso/20 px-6 py-3 h-auto rounded-full hover:bg-espresso hover:text-parchment transition-colors"
            >
              <Link href="/catalog">Все товары</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Workshops promo ── */}
      <section className="py-24 lg:py-32">
        <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-espresso/8">
            {/* Left: image */}
            <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[480px] overflow-hidden">
              <Image
                src="/images/workshops/hero-workshops.jpg"
                alt="Мастер-классы по макраме"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-espresso/20" />
            </div>

            {/* Right: text */}
            <div className="bg-sand flex flex-col justify-center px-8 md:px-12 lg:px-16 py-12 lg:py-16">
              <span className="label-caps text-terracotta mb-5 block tracking-widest">
                Обучение
              </span>
              <h2 className="font-serif text-4xl lg:text-5xl text-espresso mb-6 leading-[1.1] text-balance">
                Научитесь плести
                <br />
                <em className="not-italic text-taupe">самостоятельно</em>
              </h2>
              <p className="text-espresso/70 text-base leading-[1.8] mb-8 max-w-md">
                Видео-мастер-классы с пошаговыми инструкциями: от базовых узлов
                до готового абажура, платья или панно. Доступ навсегда, смотрите
                в своём темпе.
              </p>
              <ul className="space-y-2.5 mb-10">
                {[
                  "6 курсов по трём направлениям",
                  "HD-видео с подробными комментариями",
                  "Список материалов для каждого курса",
                  "Поддержка мастера",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-espresso/80 text-sm"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                      className="text-terracotta flex-shrink-0"
                    >
                      <path
                        d="M3 8.5l3 3 7-7"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="self-start inline-flex items-center gap-3 px-7 py-4 h-auto rounded-full bg-espresso text-parchment label-caps-md hover:bg-terracotta transition-colors"
              >
                <Link href="/workshops">
                  Смотреть мастер-классы
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
            </div>
          </div>
        </div>
      </section>

      {/* ── Process, Reviews, Order ── */}
      <Process />
      <Reviews />
      <CustomOrder />

      {/* ── FAQ ── */}
      <FAQJsonLd items={homeFaq} />
      <section className="py-20 lg:py-28 bg-parchment">
        <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <span className="label-caps text-terracotta mb-3 block">
                Вопросы и ответы
              </span>
              <h2 className="font-serif text-3xl lg:text-4xl text-espresso">
                Часто спрашивают
              </h2>
            </div>
            <div className="space-y-3">
              {homeFaq.map((item) => (
                <details
                  key={item.question}
                  className="group border border-espresso/10 rounded-xl overflow-hidden"
                >
                  <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none text-espresso hover:bg-sand transition-colors">
                    <span className="font-serif text-[17px] leading-snug">
                      {item.question}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                      className="flex-shrink-0 transition-transform duration-200 group-open:rotate-180 text-terracotta"
                    >
                      <path
                        d="M3 6l5 5 5-5"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </summary>
                  <div className="px-6 pb-5 pt-2 text-taupe text-[15px] leading-[1.8] border-t border-espresso/8">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <MobileStickyBar />
    </main>
  );
}
