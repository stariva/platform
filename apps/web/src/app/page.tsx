import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CustomOrder } from "@/components/stariva/custom-order";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { Hero } from "@/components/stariva/hero";
import { HomeOrderProvider } from "@/components/stariva/home-order-context";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/stariva/json-ld";
import { MobileStickyBar } from "@/components/stariva/mobile-sticky-bar";
import { Process } from "@/components/stariva/process";
import { Reviews } from "@/components/stariva/reviews";
import { homePortfolio } from "@/lib/home-portfolio";
import { getProducts } from "@/lib/ozon-service";
import type { Product } from "@/lib/ozon-types";
import { formatPrice } from "@/lib/products";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Одежда макраме по вашим меркам — ручная работа | Stariva",
  description:
    "Платья, топы и туники макраме ручной работы по вашим меркам. Выберите образ — обсудим цвет, плетение, стоимость и срок с мастером Stariva.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "Stariva — сплетено для вас",
    description:
      "Одежда макраме по вашим меркам. Вы выбираете образ — мы плетём вручную.",
    url: SITE_URL,
    images: [
      {
        url: "/images/home/hero-fashion-beach-v3.webp",
        width: 1536,
        height: 1024,
        alt: "Stariva — одежда макраме по вашим меркам",
      },
    ],
  },
};
const homeFaq = [
  {
    question: "Можно заказать по своим размерам или фото?",
    answer:
      "Да. Пришлите фото, размеры или описание идеи. Мастер обсудит с вами конструкцию, материал и цвет, после чего согласует стоимость и срок.",
  },
  {
    question: "Я не знаю, как снять мерки. Что делать?",
    answer:
      "Выберите в заявке «Не знаю размеры — нужна помощь» или просто опишите задачу. Для абажура обычно нужны диаметр и высота, для одежды — мерки и желаемая длина. Мастер подскажет, что измерить для вашего изделия.",
  },
  {
    question: "Сколько стоит индивидуальный заказ?",
    answer:
      "Цена зависит от модели, размера, материала и сложности плетения. Калькулятор даёт ориентир, а точную стоимость мастер подтверждает после обсуждения. Отправить заявку можно без оплаты.",
  },
  {
    question: "Когда будет готово изделие?",
    answer:
      "Срок изготовления согласуем до оплаты: он зависит от размера, сложности и загрузки мастерской. Срок доставки обсудим отдельно. Если изделие нужно к определённой дате, укажите её в заявке.",
  },
  {
    question: "Как проходит оплата и доставка?",
    answer:
      "Сначала согласуем параметры, цену, срок изготовления и доставку. После этого мастер сообщит способ оплаты. Доставка по России и самовывоз по договорённости — условия уточним до оплаты. Подробности доступны в договоре оферты.",
  },
  {
    question: "Из чего сделаны изделия?",
    answer:
      "Материал зависит от модели: используем хлопковый и другие виды шнура. Состав указан в карточке изделия. Для индивидуального заказа материал, фактуру и оттенок согласуем с вами заранее.",
  },
];

function Examples({ products = [] }: { products?: Product[] }) {
  return (
    <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
      {homePortfolio.map((item) => {
        const product = products.find((p) => item.href.endsWith(`/${p.slug}`));
        return (
          <article
            key={item.href}
            className="overflow-hidden rounded-2xl border border-espresso/10 bg-parchment"
          >
            <Link
              href={item.href}
              className="block relative aspect-[4/3] md:aspect-[4/5] overflow-hidden"
            >
              <Image
                src={item.image}
                alt={item.name}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
            </Link>
            <div className="p-5 lg:p-6">
              <h3 className="font-serif text-2xl text-espresso">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-espresso/75">
                {item.details}
              </p>
              <div className="mt-4 min-h-14 text-sm text-taupe">
                {product ? (
                  <>
                    <p className="text-espresso font-medium">
                      Модель в каталоге —{" "}
                      {formatPrice(product.price, product.currency)}
                    </p>
                    <p className="mt-1 text-xs">
                      Ваш размер рассчитаем отдельно.
                    </p>
                  </>
                ) : (
                  <p>Актуальная цена и параметры — в карточке изделия.</p>
                )}
              </div>
              <Link
                href={item.href}
                className="inline-block mt-3 text-sm text-espresso underline underline-offset-4"
              >
                Рассмотреть модель ↗
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
async function LiveExamples() {
  return <Examples products={await getProducts()} />;
}

export default function Page() {
  return (
    <main className="bg-parchment text-espresso pb-20 lg:pb-0">
      <BreadcrumbJsonLd items={[{ name: "Главная", href: "/" }]} />
      <Header variant="solid" />
      <HomeOrderProvider>
        <Hero />
        <CustomOrder />
      </HomeOrderProvider>
      <section id="examples" className="scroll-mt-24 py-14 lg:py-24">
        <div className="max-w-[1400px] mx-auto px-5 lg:px-10">
          <p className="label-caps text-terracotta mb-4">Изделия мастерской</p>
          <div className="flex flex-wrap justify-between items-end gap-5 mb-8">
            <div>
              <h2 className="font-serif text-4xl lg:text-5xl leading-tight">
                Начните с того,
                <br />
                <span className="italic">что вам близко</span>
              </h2>
              <p className="mt-4 max-w-xl text-espresso/70 leading-relaxed">
                Модели из каталога Stariva. Выберите основу — размер, цвет и
                детали обсудим для вашего заказа.
              </p>
            </div>
            <Link
              href="/catalog"
              className="py-2 text-sm underline underline-offset-4"
            >
              Весь каталог ↗
            </Link>
          </div>
          <Suspense fallback={<Examples />}>
            <LiveExamples />
          </Suspense>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-sand p-5 lg:p-6">
            <p className="text-sm text-espresso/80">
              Есть своя идея? Пришлите фото или расскажите о ней.
            </p>
            <Link
              href="#order"
              data-location="examples"
              className="rounded-full bg-espresso text-parchment px-6 py-3 text-sm"
            >
              Обсудить мой заказ ↗
            </Link>
          </div>
        </div>
      </section>
      <Process />
      <section className="bg-sand py-12 lg:py-16">
        <div className="max-w-[1400px] mx-auto px-5 lg:px-10 grid md:grid-cols-2 gap-6 lg:gap-16">
          <div>
            <p className="label-caps text-terracotta mb-3">Ваш мастер</p>
            <h2 className="font-serif text-3xl lg:text-4xl">Ольга Карпычева</h2>
          </div>
          <div>
            <p className="text-espresso/75 leading-relaxed">
              За Stariva стоит мастер, с которым можно обсудить вашу идею
              напрямую. Ольга поможет выбрать размер, материал и детали, чтобы
              изделие подходило именно вам.
            </p>
            <div className="mt-5 flex flex-wrap gap-5 text-sm">
              <Link href="/about" className="underline underline-offset-4">
                История мастерской
              </Link>
              <a
                href="https://t.me/Olga_Stariva"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                Написать Ольге ↗
              </a>
            </div>
          </div>
        </div>
      </section>
      <Suspense fallback={null}>
        <Reviews verifiedOnly />
      </Suspense>
      <FAQJsonLd items={homeFaq} />
      <section className="py-14 lg:py-20">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="font-serif text-3xl lg:text-4xl mb-8">
            До первого заказа
          </h2>
          <div className="space-y-3">
            {homeFaq.map((item) => (
              <details
                key={item.question}
                className="rounded-xl border border-espresso/15"
              >
                <summary className="cursor-pointer px-5 py-5 text-base text-espresso">
                  {item.question}
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-espresso/75">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
          <p className="mt-5 text-sm text-taupe">
            Подробные условия — в{" "}
            <Link href="/offer" className="underline underline-offset-4">
              договоре оферты
            </Link>
            .
          </p>
          <Link
            href="#order"
            data-location="faq"
            className="inline-block mt-7 rounded-full bg-terracotta text-parchment px-7 py-4 text-sm"
          >
            Получить расчёт от мастера ↗
          </Link>
        </div>
      </section>
      <section className="border-t border-espresso/10 py-10 lg:py-14">
        <div className="max-w-[1400px] mx-auto px-5 lg:px-10 grid sm:grid-cols-3 gap-6">
          {[
            {
              href: "/catalog",
              title: "Весь каталог",
              text: "Одежда, абажуры, сумки и декор.",
            },
            {
              href: "/workshops",
              title: "Научиться плести",
              text: "Видео-мастер-классы в вашем темпе.",
            },
            {
              href: "/b2b",
              title: "Для бизнеса",
              text: "Изделия для кафе, отелей и других пространств.",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-espresso/10 p-5 hover:bg-sand transition-colors"
            >
              <h2 className="font-serif text-2xl">{item.title} ↗</h2>
              <p className="mt-2 text-sm text-taupe">{item.text}</p>
            </Link>
          ))}
        </div>
      </section>
      <Footer />
      <MobileStickyBar />
    </main>
  );
}
