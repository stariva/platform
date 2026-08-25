import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import {
  BreadcrumbJsonLd,
  CourseJsonLd,
  FAQJsonLd,
} from "@/components/stariva/json-ld";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  categoryLabels,
  formatPrice,
  getWorkshopBySlug,
  levelColors,
  levelLabels,
  workshops,
} from "@/lib/workshops-data";
import { WorkshopPurchase } from "./workshop-purchase";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://stariva.ru";

export async function generateStaticParams() {
  return workshops.map((w) => ({ slug: w.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const workshop = getWorkshopBySlug(slug);
  if (!workshop) return {};

  const title = `${workshop.title} — мастер-класс по макраме`;
  const description = `${workshop.description} Уровень: ${levelLabels[workshop.level]}. ${workshop.lessonsCount} уроков, ${workshop.duration}. Купить на Ozon.`;
  const url = `/workshops/${slug}`;
  const image = `${BASE_URL}${workshop.cover}`;

  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}${url}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${BASE_URL}${url}`,
      images: [{ url: image, width: 1200, height: 675, alt: workshop.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function WorkshopDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const workshop = getWorkshopBySlug(slug);
  if (!workshop) notFound();

  const related = workshops
    .filter((w) => w.slug !== workshop.slug && w.category === workshop.category)
    .slice(0, 3);

  const url = `/workshops/${slug}`;

  const faqItems = [
    {
      question: "Как долго у меня будет доступ к курсу?",
      answer:
        "Доступ к курсу предоставляется навсегда. После покупки вы можете смотреть уроки в любое время с любого устройства.",
    },
    {
      question: "Нужен ли опыт для прохождения курса?",
      answer: `Курс рассчитан на уровень «${levelLabels[workshop.level]}». ${workshop.level === "beginner" ? "Никакого предварительного опыта не требуется — всё объясняется с нуля." : workshop.level === "intermediate" ? "Желательно знание базовых узлов макраме." : "Требуется уверенное владение базовыми техниками макраме."}`,
    },
    {
      question: "Какие материалы нужны для курса?",
      answer: `Для курса понадобятся: ${workshop.materials.join(", ")}. Полный список с рекомендациями по покупке есть в первом уроке.`,
    },
    {
      question: "Где купить курс?",
      answer:
        "Курс можно купить прямо на сайте: нажмите «Купить», оплатите онлайн через YooKassa, и доступ к видеоурокам сразу появится в вашем личном кабинете.",
    },
  ];

  return (
    <div className="min-h-screen bg-parchment text-espresso">
      <Header variant="solid" />
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Мастер-классы", href: "/workshops" },
          { name: workshop.title, href: url },
        ]}
      />
      <CourseJsonLd
        name={workshop.title}
        description={workshop.description}
        image={workshop.cover}
        price={workshop.price}
        url={url}
        duration={workshop.duration}
        level={workshop.level}
        lessonsCount={workshop.lessonsCount}
        ozonUrl={workshop.ozonUrl}
      />
      <FAQJsonLd items={faqItems} />

      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-6 md:px-10 pt-8 pb-2">
        <Breadcrumb>
          <BreadcrumbList className="text-xs text-taupe">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  href="/"
                  className="hover:text-espresso transition-colors"
                >
                  Главная
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  href="/workshops"
                  className="hover:text-espresso transition-colors"
                >
                  Мастер-классы
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage className="text-espresso">
                {workshop.title}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <main className="max-w-6xl mx-auto px-6 md:px-10 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-12 lg:gap-16">
          {/* Left: content */}
          <div>
            {/* Title block */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Link
                  href={`/workshops?category=${workshop.category}`}
                  className="label-caps text-xs text-taupe hover:text-terracotta transition-colors"
                >
                  {categoryLabels[workshop.category]}
                </Link>
                <span className="text-espresso/20">·</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border-0 ${levelColors[workshop.level]}`}
                >
                  {levelLabels[workshop.level]}
                </span>
              </div>
              <h1 className="font-serif text-4xl md:text-5xl text-espresso mb-3 text-balance">
                {workshop.title}
              </h1>
              <p className="text-taupe text-lg leading-relaxed">
                {workshop.subtitle}
              </p>
            </div>

            {/* Cover with lock */}
            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-sand mb-10">
              <Image
                src={workshop.cover}
                alt={workshop.title}
                fill
                sizes="(max-width: 1024px) 100vw, 700px"
                className="object-cover"
                priority
              />
              {/* Locked overlay */}
              <div className="absolute inset-0 bg-espresso/50 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-full bg-parchment/95 flex items-center justify-center shadow-lg">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 28 28"
                    fill="none"
                    aria-hidden="true"
                  >
                    <rect
                      x="5"
                      y="13"
                      width="18"
                      height="13"
                      rx="3"
                      stroke="#2c241b"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M9 13V10a5 5 0 0 1 10 0v3"
                      stroke="#2c241b"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <circle cx="14" cy="19.5" r="2" fill="#2c241b" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-parchment font-serif text-xl mb-1">
                    Контент защищён
                  </p>
                  <p className="text-parchment/70 text-sm">
                    Приобретите курс, чтобы смотреть все уроки
                  </p>
                </div>
              </div>
            </div>

            {/* Description */}
            <section className="mb-10">
              <h2 className="font-serif text-2xl mb-4">О курсе</h2>
              <p className="text-espresso/80 leading-[1.8] text-base">
                {workshop.description}
              </p>
            </section>

            {/* What you learn */}
            <section className="mb-10">
              <h2 className="font-serif text-2xl mb-5">Чему вы научитесь</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {workshop.whatYouLearn.map((item, i) => (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: static list, never reordered
                    key={i}
                    className="flex items-start gap-3 p-4 bg-sand rounded-xl border border-espresso/6"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 18 18"
                      fill="none"
                      aria-hidden="true"
                      className="flex-shrink-0 mt-0.5 text-terracotta"
                    >
                      <path
                        d="M3.75 9.75l3.5 3.5 7-7.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-espresso/80 text-sm leading-relaxed">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Lessons list */}
            <section className="mb-10">
              <h2 className="font-serif text-2xl mb-5">Программа курса</h2>
              <div className="flex items-center gap-4 mb-4 text-sm text-taupe">
                <span>
                  {workshop.lessonsCount} урок
                  {workshop.lessonsCount > 1 ? "а" : ""}
                </span>
                <span>·</span>
                <span>{workshop.duration} видео</span>
              </div>
              <div className="border border-espresso/10 rounded-2xl overflow-hidden">
                {workshop.lessons.map((lesson, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: lessons are positional, index is used for styling
                    key={i}
                    className={`flex items-center gap-4 px-5 py-4 ${
                      i < workshop.lessons.length - 1
                        ? "border-b border-espresso/8"
                        : ""
                    } ${i === 0 ? "bg-sand/60" : ""}`}
                  >
                    {/* Free preview or locked */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-espresso/6">
                      {i === 0 ? (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M5 3.5l5.5 3.5-5.5 3.5V3.5z"
                            fill="#b85c38"
                          />
                        </svg>
                      ) : (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          aria-hidden="true"
                        >
                          <rect
                            x="2"
                            y="6.5"
                            width="10"
                            height="7"
                            rx="1.5"
                            stroke="#8c7b6b"
                            strokeWidth="1.2"
                          />
                          <path
                            d="M4.5 6.5V5a2.5 2.5 0 0 1 5 0v1.5"
                            stroke="#8c7b6b"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-espresso/80 text-sm">
                        {lesson.title}
                      </span>
                      {i === 0 && (
                        <span className="ml-2 text-[10px] text-terracotta label-caps">
                          Бесплатно
                        </span>
                      )}
                    </div>
                    <span className="text-taupe text-xs flex-shrink-0">
                      {lesson.duration}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Materials */}
            <section>
              <h2 className="font-serif text-2xl mb-5">Материалы</h2>
              <p className="text-taupe text-sm mb-4">
                Что понадобится для курса:
              </p>
              <ul className="space-y-2">
                {workshop.materials.map((mat, i) => (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: static list, never reordered
                    key={i}
                    className="flex items-center gap-3 text-espresso/80 text-sm"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-terracotta flex-shrink-0" />
                    {mat}
                  </li>
                ))}
              </ul>
            </section>

            {/* FAQ */}
            <section className="mt-12">
              <h2 className="font-serif text-2xl mb-6">Частые вопросы</h2>
              <div className="space-y-4">
                {faqItems.map((item) => (
                  <details
                    key={item.question}
                    className="group border border-espresso/10 rounded-xl overflow-hidden"
                  >
                    <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none text-espresso font-medium hover:bg-sand transition-colors">
                      <span className="text-sm leading-snug">
                        {item.question}
                      </span>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                        className="flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
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
                    <div className="px-5 pb-4 pt-1 text-taupe text-sm leading-relaxed border-t border-espresso/8">
                      {item.answer}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          </div>

          {/* Right: sticky purchase card */}
          <div className="lg:pt-0">
            <div className="sticky top-24">
              <div className="bg-parchment border border-espresso/10 rounded-2xl overflow-hidden shadow-[0_4px_30px_rgba(44,36,27,0.08)]">
                {/* Mini cover */}
                <div className="relative aspect-[16/9] bg-sand">
                  <Image
                    src={workshop.cover}
                    alt={workshop.title}
                    fill
                    sizes="380px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-espresso/30 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-parchment/90 flex items-center justify-center">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 22 22"
                        fill="none"
                        aria-hidden="true"
                      >
                        <rect
                          x="3"
                          y="10"
                          width="16"
                          height="11"
                          rx="2"
                          stroke="#2c241b"
                          strokeWidth="1.4"
                        />
                        <path
                          d="M7 10V8a4 4 0 0 1 8 0v2"
                          stroke="#2c241b"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                        />
                        <circle cx="11" cy="15.5" r="1.5" fill="#2c241b" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="font-serif text-4xl text-espresso">
                      {formatPrice(workshop.price)}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[
                      { label: "Уроков", value: String(workshop.lessonsCount) },
                      {
                        label: "Время",
                        value: workshop.duration
                          .split(" ")
                          .slice(0, 2)
                          .join(" "),
                      },
                      { label: "Уровень", value: levelLabels[workshop.level] },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="text-center p-3 bg-sand rounded-xl"
                      >
                        <div className="font-serif text-base text-espresso">
                          {s.value}
                        </div>
                        <div className="label-caps text-[9px] text-taupe mt-0.5">
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  <WorkshopPurchase
                    slug={workshop.slug}
                    price={workshop.price}
                    title={workshop.title}
                  />

                  <p className="text-center text-xs text-taupe leading-relaxed">
                    Доступ навсегда&nbsp;·&nbsp;HD-видео&nbsp;·&nbsp;Все
                    устройства
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-20 pt-12 border-t border-espresso/10">
            <div className="flex items-baseline gap-4 mb-8">
              <h2 className="font-serif text-2xl text-espresso">
                Похожие курсы
              </h2>
              <div className="h-px flex-1 bg-espresso/10" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {related.map((w) => (
                <Link
                  key={w.slug}
                  href={`/workshops/${w.slug}`}
                  className="group flex flex-col bg-parchment border border-espresso/8 rounded-2xl overflow-hidden hover:shadow-[0_8px_30px_rgba(44,36,27,0.08)] hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-sand">
                    <Image
                      src={w.cover}
                      alt={w.title}
                      fill
                      sizes="340px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <p className="label-caps text-[10px] text-taupe mb-1">
                      {categoryLabels[w.category]}
                    </p>
                    <h3 className="font-serif text-lg text-espresso group-hover:text-terracotta transition-colors mb-1">
                      {w.title}
                    </h3>
                    <p className="font-serif text-base text-terracotta">
                      {formatPrice(w.price)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
