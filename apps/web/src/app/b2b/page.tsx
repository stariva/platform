import { CheckIcon, MessageCircleIcon, XIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ContactMasterButton } from "@/components/stariva/contact-master";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { PhoneIcon } from "@/components/stariva/icons";
import { BreadcrumbJsonLd } from "@/components/stariva/json-ld";
import { Reviews } from "@/components/stariva/reviews";
import { BULK_DISCOUNT, MAX_ORDER_ITEMS } from "@/lib/b2b/order";
import { CONTACTS } from "@/lib/contacts";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { B2BOrder } from "./_components/b2b-order";

const B2B_MESSAGE =
  "Здравствуйте, Ольга! Хочу заказать макраме для заведения. Пришлю фото места и размеры.";

export const metadata: Metadata = {
  title: "Макраме для кафе, салона и гостевого дома",
  description: `Абажуры, панно и кашпо из хлопка для небольших заведений: от 1 до ${MAX_ORDER_ITEMS} изделий, скидка ${BULK_DISCOUNT.percent}% от ${BULK_DISCOUNT.minItems} штук. Без выезда и замеров — по фото, доставка по России.`,
  alternates: { canonical: `${BASE_URL}/b2b` },
  openGraph: {
    type: "website",
    title: "Макраме для небольших заведений — Stariva",
    description: `Абажуры, панно и кашпо для кофейни, салона или гостевого дома. До ${MAX_ORDER_ITEMS} изделий, заказ по фото, доставка по России.`,
    url: `${BASE_URL}/b2b`,
    images: [
      {
        url: `https://cdn.stariva.ru/site/images/b2b/hero-cafe-editorial.webp`,
        width: 1672,
        height: 941,
        alt: "Абажуры макраме в небольшом кафе — Stariva",
      },
    ],
  },
};

// ─── Data ────────────────────────────────────────────────────────────────────

const useCases = [
  {
    label: "Кофейни и пекарни",
    image: "https://cdn.stariva.ru/site/images/b2b/hero-cafe-editorial.webp",
    alt: "Хлопковые абажуры макраме над столиками светлой кофейни",
    objectPosition: "65% center",
    items: ["2–6 абажуров над столиками", "Панно за стойкой", "Кашпо у окна"],
  },
  {
    label: "Небольшие кафе и бары",
    image:
      "https://cdn.stariva.ru/site/images/b2b/project-restaurant-editorial.webp",
    alt: "Плетёный декор макраме рядом с сервированным столом",
    objectPosition: "60% center",
    items: [
      "Абажуры над баром",
      "Панно как фон для фото",
      "Кашпо с зеленью в зале",
    ],
  },
  {
    label: "Гостевые дома и апартаменты",
    image:
      "https://cdn.stariva.ru/site/images/b2b/project-hotel-editorial.webp",
    alt: "Панно из натурального хлопка за деревянной стойкой",
    objectPosition: "center 45%",
    items: [
      "Панно над кроватью в каждом номере",
      "Абажуры в номера",
      "Панно у входа",
    ],
  },
  {
    label: "Салоны, студии, шоурумы",
    image:
      "https://cdn.stariva.ru/site/images/b2b/project-office-editorial.webp",
    alt: "Светлое помещение с подвесным декором макраме",
    objectPosition: "center center",
    items: ["Панно у ресепшна", "Абажуры в зоне ожидания", "Кашпо для зелени"],
  },
];

const orderSteps = [
  {
    step: "01",
    title: "Напишите, что нужно",
    desc: "Соберите заказ на этой странице или просто напишите в мессенджер: что, сколько и для какого места.",
  },
  {
    step: "02",
    title: "Пришлите фото",
    desc: "Сфотографируйте место, где будут висеть изделия, и рулеткой измерьте стену или высоту потолка — подскажу, что именно мерить. Приезжать на замер не нужно.",
  },
  {
    step: "03",
    title: "Согласуем и плету",
    desc: "Подберу размеры и цвет, пришлю фото похожих работ и точную цену. Предоплата 50%, остаток — когда изделия готовы и вы увидели их на фото.",
  },
  {
    step: "04",
    title: "Отправляю",
    desc: "Упаковываю и отправляю СДЭК или Почтой по всей России. Панно и кашпо вешаются на обычный крючок, абажур — на ваш светильник.",
  },
];

const doList = [
  `Абажуры, панно и кашпо — от 1 до ${MAX_ORDER_ITEMS} изделий`,
  "Натуральный хлопок или один цвет на выбор",
  "Фото готовых изделий перед отправкой",
  "Чек НПД, по запросу — договор и акт",
  "Гарантия 12 месяцев на плетение",
];

const dontList = [
  "Выезд, замеры и монтаж",
  "Дизайн-проект и визуализации",
  "Перегородки во всю стену и крупные инсталляции",
  `Заказы больше ${MAX_ORDER_ITEMS} изделий`,
  "Подбор цвета по брендбуку и Pantone",
  "Электрику: абажур идёт без патрона и провода",
];

const faqItems = [
  {
    q: "Какой минимальный заказ?",
    a: `Одно изделие. Верхняя граница — ${MAX_ORDER_ITEMS}: всё плету сама, и больше за один заказ не успею сделать в срок.`,
  },
  {
    q: "Как быстро сделаете?",
    a: "До 5 изделий — 2–3 недели, до 12 — 3–4 недели, до 20 — 4–6 недель от предоплаты. Если у вас дата открытия, напишите её сразу — скажу, успеваю ли.",
  },
  {
    q: "Как понять размер без замера?",
    a: "По фото и паре цифр: ширина стены, высота потолка, размер стола или стойки. Подскажу, что измерить, и предложу размер. Перед плетением согласуем его письменно.",
  },
  {
    q: "Кто будет вешать?",
    a: "Вы сами или ваш мастер. Панно и кашпо — на обычный крючок или гвоздь, абажур надевается на светильник. Электрику подключает электрик.",
  },
  {
    q: "Есть скидка?",
    a: `От ${BULK_DISCOUNT.minItems} изделий в одном заказе — ${BULK_DISCOUNT.percent}%.`,
  },
  {
    q: "Какие документы даёте?",
    a: "Я самозанятая: выдаю чек НПД, его можно провести как расход. Если бухгалтерии нужны договор и акт — подготовлю.",
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function B2BPage() {
  return (
    <div className="bg-parchment text-espresso pt-[60px] lg:pt-[68px]">
      <Header variant="solid" />
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Для бизнеса", href: "/b2b" },
        ]}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[88vh] flex items-end overflow-hidden bg-espresso">
        <div className="absolute inset-x-0 top-0 h-[480px] md:h-full">
          <Image
            src="https://cdn.stariva.ru/site/images/b2b/hero-cafe-editorial.webp"
            alt="Абажуры ручного плетения в кафе с деревянной мебелью и дневным светом из окна"
            fill
            priority
            unoptimized
            className="object-cover object-[66%_center] lg:object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-espresso via-espresso/15 to-transparent md:from-espresso/90 md:via-espresso/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-espresso/20 to-transparent md:from-espresso/55 md:via-espresso/10" />
        </div>

        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-6 lg:px-14 pb-16 lg:pb-24 pt-[280px] md:pt-[100px]">
          <div className="max-w-3xl">
            <p className="label-caps text-linen/60 mb-5 tracking-widest">
              Для бизнеса
            </p>
            <h1 className="font-serif text-white text-[clamp(3rem,6.5vw,6rem)] leading-[0.95] tracking-tight text-balance">
              Макраме для
              <br />
              <em className="not-italic text-linen">небольшого заведения</em>
            </h1>
            <p className="mt-8 text-white/70 text-lg lg:text-xl max-w-lg leading-[1.75]">
              Абажуры, панно и кашпо для кофейни, салона или гостевого дома — от
              1 до {MAX_ORDER_ITEMS} изделий. Плету сама, заказ по фото,
              отправляю готовое по России.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href="#order"
                className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white text-espresso label-caps-md hover:bg-linen transition-colors duration-300"
              >
                Посчитать заказ
              </a>
              <ContactMasterButton
                source="b2b_hero"
                message={B2B_MESSAGE}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-full border border-white/30 text-white label-caps-md hover:border-white/60 transition-colors duration-300"
              >
                <MessageCircleIcon className="w-4 h-4" strokeWidth={1.3} />
                Написать Ольге
              </ContactMasterButton>
            </div>
          </div>

          <div className="mt-14 flex flex-wrap gap-px border border-white/10 rounded-xl overflow-hidden w-fit">
            {[
              { value: `1–${MAX_ORDER_ITEMS}`, label: "изделий\nв заказе" },
              {
                value: `−${BULK_DISCOUNT.percent}%`,
                label: `от ${BULK_DISCOUNT.minItems}\nизделий`,
              },
              { value: "2–6", label: "недель\nизготовления" },
              { value: "0", label: "выездов —\nвсё по фото" },
            ].map((s) => (
              <div
                key={s.label}
                className="px-7 py-5 bg-white/8 backdrop-blur-sm flex flex-col gap-1 min-w-[110px]"
              >
                <span className="font-serif text-3xl lg:text-4xl text-white leading-none">
                  {s.value}
                </span>
                <span className="label-caps text-white/75 text-[11px] leading-tight whitespace-pre">
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
              Небольших
              <br />
              <span className="text-taupe">помещений</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {useCases.map((uc) => (
              <div
                key={uc.label}
                className="group rounded-2xl overflow-hidden border border-espresso/8 hover:border-espresso/20 transition-all duration-300 hover:shadow-[0_8px_40px_rgba(22,21,19,0.08)]"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-sand">
                  <Image
                    src={uc.image}
                    alt={uc.alt}
                    fill
                    unoptimized
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{ objectPosition: uc.objectPosition }}
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

      {/* ── Process ──────────────────────────────────────────────────────── */}
      <section
        id="process"
        className="py-28 lg:py-40 bg-espresso text-parchment"
      >
        <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
          <div className="mb-16 lg:mb-20">
            <p className="label-caps text-linen/50 tracking-widest mb-4">
              Как заказать
            </p>
            <h2 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-parchment leading-[1.05]">
              Четыре шага, всё онлайн
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
                  <h3 className="font-serif text-xl lg:text-2xl text-parchment lg:w-56 flex-shrink-0">
                    {item.title}
                  </h3>
                  <p className="text-parchment/70 text-[14px] leading-[1.85] lg:max-w-2xl">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
            <div className="border-t border-parchment/8" />
          </div>
        </div>
      </section>

      {/* ── Do / don't ───────────────────────────────────────────────────── */}
      <section className="py-28 lg:py-40 bg-sand">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
          <div className="mb-16 lg:mb-20 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <p className="label-caps text-terracotta tracking-widest mb-4">
                Честно о формате
              </p>
              <h2 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-espresso leading-[1.05]">
                Что делаю
                <br />
                <span className="text-taupe">и чего не делаю</span>
              </h2>
            </div>
            <p className="text-taupe text-base leading-[1.8] max-w-sm lg:text-right">
              Всё плету я одна, поэтому беру заказы, которые могу сделать хорошо
              и в срок.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-espresso/8 border border-espresso/8 rounded-2xl overflow-hidden">
            <div className="bg-sand p-8 lg:p-10">
              <h3 className="font-serif text-2xl text-espresso mb-6">Делаю</h3>
              <ul className="space-y-4">
                {doList.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-espresso/80 leading-relaxed"
                  >
                    <CheckIcon
                      className="mt-1 size-4 shrink-0 text-terracotta"
                      strokeWidth={1.6}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-sand p-8 lg:p-10">
              <h3 className="font-serif text-2xl text-espresso mb-6">
                Не делаю
              </h3>
              <ul className="space-y-4">
                {dontList.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-taupe leading-relaxed"
                  >
                    <XIcon
                      className="mt-1 size-4 shrink-0 text-espresso/40"
                      strokeWidth={1.6}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Order ────────────────────────────────────────────────────────── */}
      <B2BOrder />

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="py-28 lg:py-40 bg-sand">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-14">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-14">
              <p className="label-caps text-terracotta tracking-widest mb-4">
                FAQ
              </p>
              <h2 className="font-serif text-[clamp(2rem,4vw,3.5rem)] text-espresso leading-[1.1]">
                Частые вопросы
              </h2>
            </div>
            <div className="space-y-3">
              {faqItems.map((item) => (
                <details
                  key={item.q}
                  className="group border border-espresso/10 rounded-xl overflow-hidden bg-parchment"
                >
                  <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none text-espresso hover:bg-white transition-colors">
                    <span className="font-serif text-[17px] leading-snug">
                      {item.q}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                      className="flex-shrink-0 transition-transform duration-200 group-open:rotate-180 text-espresso/60"
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
            <div className="lg:col-span-6">
              <p className="label-caps text-terracotta tracking-widest mb-4">
                Проще написать?
              </p>
              <h2 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-espresso leading-[1.05] text-balance mb-6">
                Пришлите фото — подскажу, что подойдёт
              </h2>
              <p className="text-taupe text-base leading-[1.8] max-w-md">
                Сфотографируйте помещение и напишите, сколько примерно изделий
                нужно. Обычно отвечаю в течение часа в рабочее время.
              </p>
              <div className="mt-8 pt-6 border-t border-espresso/12 text-sm text-espresso/60 label-caps">
                {CONTACTS.hours}
              </div>
            </div>

            <div className="lg:col-span-6 bg-parchment border border-espresso/10 rounded-2xl p-8 lg:p-10 flex flex-col gap-4">
              <p className="text-espresso/60 text-[14px] leading-[1.75]">
                Удобнее всего в Telegram, WhatsApp или MAX — туда сразу можно
                прислать фото.
              </p>
              <ContactMasterButton
                source="b2b_contacts"
                message={B2B_MESSAGE}
                className="flex items-center gap-4 px-7 py-5 rounded-full bg-espresso text-parchment hover:bg-terracotta-dark transition-colors duration-300"
              >
                <MessageCircleIcon
                  className="w-5 h-5 shrink-0"
                  strokeWidth={1.3}
                />
                <span className="label-caps-md">Написать Ольге</span>
              </ContactMasterButton>
              <a
                href={CONTACTS.phoneHref}
                className="flex items-center gap-4 px-7 py-5 rounded-full border border-espresso/20 text-espresso hover:border-espresso hover:bg-espresso/5 transition-colors duration-300"
              >
                <PhoneIcon className="w-5 h-5 shrink-0" />
                <span className="font-serif text-xl">{CONTACTS.phone}</span>
              </a>
              <p className="text-espresso/70 text-[11px] label-caps pt-2 border-t border-espresso/8">
                Чек НПД, по запросу — договор и акт
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Related ──────────────────────────────────────────────────────── */}
      <section className="py-16 lg:py-20 border-t border-espresso/8">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-14 flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-taupe text-sm">
            Готовые изделия можно посмотреть в каталоге
          </p>
          <div className="flex flex-wrap gap-4">
            {[
              { href: "/abazhury", label: "Абажуры" },
              { href: "/catalog", label: "Каталог" },
              {
                href: "/blog/makrame-dlya-kafe-i-restoranov-kommercheskiy-dekor",
                label: "Статья о декоре для кафе",
              },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-2 label-caps-md text-espresso border border-espresso/15 px-6 py-3 rounded-full hover:border-espresso transition-colors"
              >
                {link.label}
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
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
