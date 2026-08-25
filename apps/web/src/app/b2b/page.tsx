import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { PhoneIcon, TelegramIcon } from "@/components/stariva/icons";
import { BreadcrumbJsonLd } from "@/components/stariva/json-ld";
import { Reviews } from "@/components/stariva/reviews";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://stariva.ru";

export const metadata: Metadata = {
  title: "Декор для кафе и ресторанов — корпоративные заказы Stariva",
  description:
    "Макраме-декор для кафе, ресторанов, отелей и офисов. Абажуры, панно, зонирующие ширмы — корпоративные заказы от 3 изделий. Бесплатная консультация.",
  alternates: { canonical: `${BASE_URL}/b2b` },
  openGraph: {
    type: "website",
    title: "Декор для бизнеса — Stariva",
    description:
      "Макраме-декор для кафе, ресторанов, отелей и офисов. Корпоративные заказы от 3 изделий.",
    url: `${BASE_URL}/b2b`,
    images: [
      {
        url: `${BASE_URL}/images/b2b/hero-cafe.png`,
        width: 1200,
        height: 630,
        alt: "Макраме-декор для кафе — Stariva",
      },
    ],
  },
};

// ─── Data ────────────────────────────────────────────────────────────────────

const advantages = [
  {
    number: "01",
    title: "Авторский дизайн под ваш интерьер",
    body: "Разрабатываем эскиз под конкретное помещение: размеры, стиль, высота потолков. Не шаблоны — концепция под ваш проект.",
  },
  {
    number: "02",
    title: "Долговечность без обслуживания",
    body: "Натуральный хлопок не теряет форму годами. Раз в неделю — пылесос. Этого достаточно для поддержания вида в коммерческом помещении.",
  },
  {
    number: "03",
    title: "Фотозона в подарок",
    body: "Красивое макраме само по себе создаёт точку притяжения для фото. Ваши гости публикуют — вы получаете органический охват без рекламного бюджета.",
  },
  {
    number: "04",
    title: "Акустический эффект",
    body: "Плотное хлопковое плетение рассеивает звук. Абажуры и панно снижают реверберацию в залах с твёрдыми поверхностями — актуально для open-space кафе.",
  },
  {
    number: "05",
    title: "Документы для бухгалтерии",
    body: "Работаем по договору, выставляем счёт и закрывающие документы. ИП на УСН. Подходит для корпоративных расходов.",
  },
  {
    number: "06",
    title: "Гарантия и поддержка",
    body: "12 месяцев гарантии на конструкцию. Если изделие деформировалось по нашей вине — переделаем. Всегда на связи для консультаций по уходу.",
  },
];

const useCases = [
  {
    label: "Кафе и кофейни",
    image: "/images/b2b/hero-cafe.png",
    items: [
      "Абажуры над барной стойкой",
      "Панно как фоновый декор",
      "Зонирование столиков ширмами",
      "Instagram-точка притяжения",
    ],
  },
  {
    label: "Рестораны",
    image: "/images/b2b/project-restaurant.png",
    items: [
      "Декоративные перегородки",
      "Крупноформатные панно",
      "Сезонные инсталляции",
      "VIP-зоны и приватные кабинеты",
    ],
  },
  {
    label: "Отели и лобби",
    image: "/images/b2b/project-hotel.png",
    items: [
      "Арт-объекты для холла",
      "Декор номеров и сьютов",
      "Навигационные зоны",
      "Брендовые инсталляции",
    ],
  },
  {
    label: "Офисы и коворкинги",
    image: "/images/b2b/project-office.png",
    items: [
      "Акустические панели",
      "Зонирование open-space",
      "Ресепшн и переговорные",
      "Корпоративные подарки",
    ],
  },
];

const orderSteps = [
  {
    step: "01",
    title: "Заявка",
    desc: "Напишите в Telegram или позвоните. Расскажите про помещение: площадь, высота потолков, стиль. Приложите фото если есть.",
  },
  {
    step: "02",
    title: "Концепция",
    desc: "В течение 2 рабочих дней предложим эскиз, подберём размеры и материалы. Бесплатно и без обязательств.",
  },
  {
    step: "03",
    title: "Договор и предоплата",
    desc: "После согласования подписываем договор. Предоплата 50%, остаток — перед отгрузкой. Счёт, УПД, закрывающие документы.",
  },
  {
    step: "04",
    title: "Изготовление",
    desc: "Срок зависит от объёма: от 2 недель для стандартных позиций до 6 недель для крупных инсталляций. Фотоотчёт по готовности.",
  },
  {
    step: "05",
    title: "Доставка и монтаж",
    desc: "Доставляем по России транспортной компанией. Для Москвы — возможен выезд мастера для монтажа и финальной настройки.",
  },
];

const faqItems = [
  {
    q: "Какой минимальный заказ?",
    a: "От 3 изделий для корпоративного заказа. Для одного изделия работаем как с частными заказчиками — без минимального порога.",
  },
  {
    q: "Можно ли заказать изделия в фирменных цветах компании?",
    a: "Да. Хлопок красим натуральными красителями. Подбираем цвет под ваш брендбук или интерьер — по образцу или Pantone-коду. Стоимость крашения обсуждается отдельно.",
  },
  {
    q: "Как быстро сделаете?",
    a: "Стандартные позиции — 2–3 недели от предоплаты. Крупные инсталляции (от 5 изделий или нестандартные размеры) — 4–6 недель. Сроки фиксируем в договоре.",
  },
  {
    q: "Делаете ли монтаж?",
    a: "Для Москвы и Подмосковья — да, выезд мастера для монтажа и регулировки. Для других регионов — подробные инструкции по монтажу, всё крепится стандартными крюками.",
  },
  {
    q: "Есть ли скидки на оптовые заказы?",
    a: "Да. При заказе от 5 изделий — скидка 10%. От 10 изделий — скидка 15% и приоритет в очереди. Обсуждаем индивидуально.",
  },
  {
    q: "Какие документы предоставляете?",
    a: "Договор подряда, счёт на оплату, УПД (универсальный передаточный документ). Работаем как ИП на УСН.",
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function B2BPage() {
  return (
    <div className="bg-parchment text-espresso">
      <Header variant="solid" />
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Для бизнеса", href: "/b2b" },
        ]}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[88vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/b2b/hero-cafe.png"
            alt="Макраме-декор в кафе"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-espresso/85 via-espresso/30 to-espresso/10" />
        </div>

        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-6 lg:px-14 pb-16 lg:pb-24 pt-[100px]">
          <div className="max-w-3xl">
            <p className="label-caps text-linen/60 mb-5 tracking-widest">
              Для бизнеса
            </p>
            <h1 className="font-serif text-white text-[clamp(3rem,6.5vw,6rem)] leading-[0.95] tracking-tight text-balance">
              Декор, который
              <br />
              <em className="not-italic text-linen">работает на вас</em>
            </h1>
            <p className="mt-8 text-white/70 text-lg lg:text-xl max-w-lg leading-[1.75]">
              Макраме для кафе, ресторанов, отелей и офисов. Авторский дизайн,
              корпоративные документы, гарантия 12 месяцев.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href="https://t.me/Olga_Stariva"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white text-espresso label-caps-md hover:bg-linen transition-colors duration-300"
              >
                <TelegramIcon className="w-4 h-4" />
                Обсудить проект
              </a>
              <a
                href="#process"
                className="inline-flex items-center gap-3 px-8 py-4 rounded-full border border-white/30 text-white label-caps-md hover:border-white/60 transition-colors duration-300"
              >
                Как работаем
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M7 2v10M3 8l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          </div>

          {/* Кейс-числа */}
          <div className="mt-14 flex flex-wrap gap-px border border-white/10 rounded-xl overflow-hidden w-fit">
            {[
              { value: "50+", label: "коммерческих\nпроектов" },
              { value: "12", label: "месяцев\nгарантии" },
              { value: "2–6", label: "недели\nизготовления" },
              { value: "100%", label: "натуральный\nхлопок" },
            ].map((s, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: static list
                key={i}
                className="px-7 py-5 bg-white/8 backdrop-blur-sm flex flex-col gap-1 min-w-[110px]"
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

      {/* ── Use cases ────────────────────────────────────────────────────── */}
      <section className="py-28 lg:py-40">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
          <div className="mb-16 lg:mb-20">
            <p className="label-caps text-terracotta tracking-widest mb-4">
              Подходит для
            </p>
            <h2 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-espresso leading-[1.05]">
              Любой коммерческой
              <br />
              <span className="text-taupe">площадки</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {useCases.map((uc) => (
              <div
                key={uc.label}
                className="group rounded-2xl overflow-hidden border border-espresso/8 hover:border-espresso/20 transition-all duration-300 hover:shadow-[0_8px_40px_rgba(22,21,19,0.08)]"
              >
                <div className="relative h-52 overflow-hidden bg-sand">
                  <Image
                    src={uc.image}
                    alt={uc.label}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-espresso/50 to-transparent" />
                  <div className="absolute bottom-5 left-6">
                    <span className="font-serif text-2xl text-white">
                      {uc.label}
                    </span>
                  </div>
                </div>
                <div className="p-6 bg-white">
                  <ul className="space-y-2.5">
                    {uc.items.map((item) => (
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
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Advantages ────────────────────────────────────────────────────── */}
      <section className="py-28 lg:py-40 bg-sand">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
          <div className="mb-16 lg:mb-20 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <p className="label-caps text-terracotta tracking-widest mb-4">
                Почему Stariva
              </p>
              <h2 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-espresso leading-[1.05]">
                Преимущества
                <br />
                <span className="text-taupe">для бизнеса</span>
              </h2>
            </div>
            <p className="text-taupe text-base leading-[1.8] max-w-sm lg:text-right">
              Работаем с коммерческими объектами с 2020 года. Больше 50
              реализованных проектов по всей России.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-espresso/8 border border-espresso/8 rounded-2xl overflow-hidden">
            {advantages.map((adv) => (
              <div
                key={adv.number}
                className="bg-sand p-8 lg:p-10 flex flex-col gap-4"
              >
                <span className="font-serif text-5xl text-espresso/10 leading-none select-none">
                  {adv.number}
                </span>
                <h3 className="font-serif text-xl lg:text-2xl text-espresso leading-tight">
                  {adv.title}
                </h3>
                <p className="text-taupe leading-[1.8] text-[14px]">
                  {adv.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Process ──────────────────────────────────────────────────────── */}
      <section
        id="process"
        className="py-28 lg:py-40 bg-espresso text-parchment"
      >
        <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
          <div className="mb-16 lg:mb-20">
            <p className="label-caps text-linen/50 tracking-widest mb-4">
              Процесс
            </p>
            <h2 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-parchment leading-[1.05]">
              Как мы работаем
            </h2>
          </div>

          <div className="space-y-0">
            {orderSteps.map((item) => (
              <div
                key={item.step}
                className="grid grid-cols-[56px_1fr] lg:grid-cols-[100px_1fr] gap-6 lg:gap-12 py-9 border-t border-parchment/8 group"
              >
                <div className="font-serif text-4xl lg:text-5xl text-parchment/15 group-hover:text-parchment/40 transition-colors duration-300 leading-none pt-1">
                  {item.step}
                </div>
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 lg:gap-16">
                  <h3 className="font-serif text-xl lg:text-2xl text-parchment lg:w-48 flex-shrink-0">
                    {item.title}
                  </h3>
                  <p className="text-parchment/55 text-[14px] leading-[1.85] lg:max-w-2xl">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
            <div className="border-t border-parchment/8" />
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="py-28 lg:py-40">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-14">
              <p className="label-caps text-terracotta tracking-widest mb-4">
                FAQ
              </p>
              <h2 className="font-serif text-[clamp(2rem,4vw,3.5rem)] text-espresso leading-[1.1]">
                Вопросы о корпоративных заказах
              </h2>
            </div>
            <div className="space-y-3">
              {faqItems.map((item) => (
                <details
                  key={item.q}
                  className="group border border-espresso/10 rounded-xl overflow-hidden"
                >
                  <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none text-espresso hover:bg-sand transition-colors">
                    <span className="font-serif text-[17px] leading-snug">
                      {item.q}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                      className="flex-shrink-0 transition-transform duration-200 group-open:rotate-180 text-espresso/40"
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
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Reviews ──────────────────────────────────────────────────────── */}
      <Reviews limit={3} heading="Нас выбирают — и возвращаются" />

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-28 lg:py-40 bg-sand">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            {/* Left: text */}
            <div className="lg:col-span-6">
              <p className="label-caps text-terracotta tracking-widest mb-4">
                Начнём?
              </p>
              <h2 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-espresso leading-[1.05] text-balance mb-6">
                Расскажите о вашем проекте
              </h2>
              <p className="text-taupe text-base leading-[1.8] max-w-md">
                Консультация бесплатная. Обычно отвечаю в течение часа в рабочее
                время. Фото помещения поможет предложить точное решение.
              </p>
              <div className="mt-8 pt-6 border-t border-espresso/12 text-sm text-espresso/60 label-caps">
                Пн–Сб, 10:00–20:00 МСК
              </div>
            </div>

            {/* Right: contacts */}
            <div className="lg:col-span-6 bg-parchment border border-espresso/10 rounded-2xl p-8 lg:p-10 flex flex-col gap-4">
              <p className="text-espresso/60 text-[14px] leading-[1.75]">
                Удобнее всего через Telegram — можно сразу прислать фото и
                замеры.
              </p>
              <a
                href="https://t.me/Olga_Stariva"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 px-7 py-5 rounded-full bg-espresso text-parchment hover:bg-terracotta-dark transition-colors duration-300"
              >
                <TelegramIcon className="w-5 h-5 shrink-0" />
                <span className="label-caps-md">Написать в Telegram</span>
              </a>
              <a
                href="tel:+79778722546"
                className="flex items-center gap-4 px-7 py-5 rounded-full border border-espresso/20 text-espresso hover:border-espresso hover:bg-espresso/5 transition-colors duration-300"
              >
                <PhoneIcon className="w-5 h-5 shrink-0" />
                <span className="font-serif text-xl">+7 977 872 25 46</span>
              </a>
              <p className="text-espresso/40 text-[11px] label-caps pt-2 border-t border-espresso/8">
                Работаем по договору — ИП, документы для бухгалтерии
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Related ──────────────────────────────────────────────────────── */}
      <section className="py-16 lg:py-20 border-t border-espresso/8">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-14 flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-taupe text-sm">
            Смотрите примеры изделий в нашем каталоге
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 label-caps-md text-espresso border border-espresso/15 px-6 py-3 rounded-full hover:border-espresso transition-colors"
            >
              Каталог
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 6h8M7 3l3 3-3 3"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link
              href="/blog/makrame-dlya-kafe-i-restoranov-kommercheskiy-dekor"
              className="inline-flex items-center gap-2 label-caps-md text-espresso border border-espresso/15 px-6 py-3 rounded-full hover:border-espresso transition-colors"
            >
              Статья о декоре для кафе
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 6h8M7 3l3 3-3 3"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
