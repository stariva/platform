import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { BreadcrumbJsonLd, ItemListJsonLd } from "@/components/stariva/json-ld";
import { Badge } from "@/components/ui/badge";
import {
  categoryLabels,
  formatPrice,
  levelColors,
  levelLabels,
  type WorkshopCategory,
  type WorkshopLevel,
  workshops,
} from "@/lib/workshops-data";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://stariva.ru";

export const metadata: Metadata = {
  title: "Мастер-классы по макраме онлайн — видеокурсы Stariva",
  description:
    "Видео-мастер-классы по макраме: абажуры, одежда и декор интерьера. Пошаговые инструкции от мастера Stariva. Доступ навсегда, HD-видео.",
  alternates: { canonical: `${BASE_URL}/workshops` },
  openGraph: {
    type: "website",
    title: "Мастер-классы по макраме онлайн — Stariva",
    description:
      "Видео-мастер-классы по макраме: абажуры, одежда и декор интерьера. Пошаговые инструкции от мастера Stariva.",
    url: `${BASE_URL}/workshops`,
    images: [
      {
        url: `${BASE_URL}/images/workshops/hero-workshops.jpg`,
        width: 1200,
        height: 630,
        alt: "Мастер-классы по макраме Stariva",
      },
    ],
  },
};

const _categories: { value: WorkshopCategory | "all"; label: string }[] = [
  { value: "all", label: "Все направления" },
  { value: "lampshades", label: "Абажуры" },
  { value: "clothing", label: "Одежда" },
  { value: "interior", label: "Декор интерьера" },
];

function LevelBadge({ level }: { level: WorkshopLevel }) {
  return (
    <Badge
      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide border-0 ${levelColors[level]}`}
    >
      {levelLabels[level]}
    </Badge>
  );
}

function WorkshopCard({ workshop }: { workshop: (typeof workshops)[0] }) {
  return (
    <Link
      href={`/workshops/${workshop.slug}`}
      className="group flex flex-col bg-parchment border border-espresso/8 rounded-2xl overflow-hidden hover:shadow-[0_8px_40px_rgba(44,36,27,0.10)] hover:-translate-y-1 transition-all duration-300"
    >
      {/* Cover image */}
      <div className="relative aspect-[16/9] overflow-hidden bg-sand">
        <Image
          src={workshop.cover}
          alt={workshop.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Locked overlay */}
        <div className="absolute inset-0 bg-espresso/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-12 h-12 rounded-full bg-parchment/90 flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="4"
                y="9"
                width="12"
                height="9"
                rx="2"
                stroke="#2c241b"
                strokeWidth="1.4"
              />
              <path
                d="M7 9V6.5a3 3 0 0 1 6 0V9"
                stroke="#2c241b"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <circle cx="10" cy="13.5" r="1.5" fill="#2c241b" />
            </svg>
          </div>
        </div>
        {/* Category tag */}
        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 rounded-full bg-parchment/90 backdrop-blur-sm text-[11px] label-caps text-espresso">
            {categoryLabels[workshop.category]}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5">
        <div className="flex items-center justify-between mb-3">
          <LevelBadge level={workshop.level} />
          <div className="flex items-center gap-1 text-taupe text-xs">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="7"
                cy="7"
                r="5.5"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M7 4.5V7l2 1.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            {workshop.duration}
          </div>
        </div>

        <h3 className="font-serif text-xl text-espresso mb-1 group-hover:text-terracotta transition-colors text-balance">
          {workshop.title}
        </h3>
        <p className="text-taupe text-sm leading-relaxed mb-4 flex-1 line-clamp-2">
          {workshop.subtitle}
        </p>

        <div className="flex items-center justify-between pt-4 border-t border-espresso/8">
          <div className="flex items-center gap-3 text-xs text-taupe">
            <span>{workshop.lessonsCount} уроков</span>
          </div>
          <span className="font-serif text-xl text-espresso">
            {formatPrice(workshop.price)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function WorkshopsPage() {
  const featured = workshops.filter((w) => w.featured);
  const _rest = workshops.filter((w) => !w.featured);

  return (
    <div className="min-h-screen bg-parchment text-espresso">
      <Header variant="solid" />
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Мастер-классы", href: "/workshops" },
        ]}
      />
      <ItemListJsonLd
        name="Мастер-классы по макраме — Stariva"
        url="/workshops"
        items={workshops.map((w) => ({
          name: w.title,
          url: `/workshops/${w.slug}`,
          image: `${BASE_URL}${w.cover}`,
        }))}
      />

      {/* Hero */}
      <section className="relative h-[420px] md:h-[500px] overflow-hidden">
        <Image
          src="/images/workshops/hero-workshops.jpg"
          alt="Мастер-классы Stariva"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-espresso/70 via-espresso/40 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end pb-14 md:pb-20 px-6 md:px-12 lg:px-20 max-w-5xl">
          <p className="label-caps text-linen/70 mb-4 tracking-widest">
            Видео-курсы
          </p>
          <h1 className="font-serif text-4xl md:text-6xl text-parchment leading-tight text-balance mb-4">
            Мастер-классы
            <br />
            <em className="not-italic text-linen">по макраме</em>
          </h1>
          <p className="text-parchment/80 max-w-lg leading-relaxed text-lg">
            Пошаговые видео-уроки от мастера Stariva — от первого узла до
            готового изделия.
          </p>
        </div>
      </section>

      {/* Trust bar */}
      <div className="bg-sand border-y border-espresso/8">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-5 flex flex-wrap items-center justify-center gap-8 md:gap-14">
          {[
            {
              icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
              label: "Доступ навсегда",
            },
            {
              icon: "M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z",
              label: "Видео в HD",
            },
            {
              icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z",
              label: "С любого устройства",
            },
            {
              icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0",
              label: "Поддержка мастера",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 text-espresso/70"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-terracotta flex-shrink-0"
              >
                <path
                  d={item.icon}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="label-caps-md text-espresso/80">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-20">
        {/* Featured */}
        {featured.length > 0 && (
          <section className="mb-16">
            <div className="flex items-baseline gap-4 mb-8">
              <h2 className="font-serif text-3xl text-espresso">
                Популярные курсы
              </h2>
              <div className="h-px flex-1 bg-espresso/10" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featured.map((w) => (
                <WorkshopCard key={w.slug} workshop={w} />
              ))}
            </div>
          </section>
        )}

        {/* Category sections */}
        {(["lampshades", "clothing", "interior"] as WorkshopCategory[]).map(
          (cat) => {
            const catWorkshops = workshops.filter((w) => w.category === cat);
            if (catWorkshops.length === 0) return null;
            return (
              <section key={cat} className="mb-14">
                <div className="flex items-baseline gap-4 mb-8">
                  <h2 className="font-serif text-2xl text-espresso">
                    {categoryLabels[cat]}
                  </h2>
                  <div className="h-px flex-1 bg-espresso/10" />
                  <span className="text-sm text-taupe">
                    {catWorkshops.length} курс
                    {catWorkshops.length > 1 ? "а" : ""}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {catWorkshops.map((w) => (
                    <WorkshopCard key={w.slug} workshop={w} />
                  ))}
                </div>
              </section>
            );
          },
        )}
      </main>

      <Footer />
    </div>
  );
}
