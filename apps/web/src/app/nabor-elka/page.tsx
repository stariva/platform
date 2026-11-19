import type { Metadata } from "next";
import Image from "next/image";
import { ReviewCard } from "@/components/stariva/review-card";
import { RatingPanel } from "@/components/stariva/reviews";
import {
  getProductsResult,
  getReviews,
  summarizeRatings,
} from "@/lib/catalog/service";
import { KIT_COLORS } from "@/lib/commerce/elka-kit-bundle";
import { CONTACTS } from "@/lib/contacts";
import { SELLER } from "@/lib/legal";
import { SITE_URL } from "@/lib/site-url";
import { ELKA_KIT_PATH, FAQ } from "./_data";
import { KitLanding } from "./kit-landing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Набор для плетения ёлки макраме — Stariva" },
  description:
    "Сплетите настенную ёлку макраме 50×110 см за два уютных вечера. Материалы, видеоурок и поддержка мастера в одной коробке.",
  alternates: { canonical: `${SITE_URL}${ELKA_KIT_PATH}` },
};

export default async function NaborElkaPage() {
  const { products, status } = await getProductsResult();
  const variants = KIT_COLORS.flatMap((color) => {
    const product = products.find(
      (item) => item.slug === color.slug && item.subcategory === "kits",
    );
    return product ? [{ ...color, product }] : [];
  });
  const reviews = (
    await Promise.all(
      variants.map(({ product }) => getReviews({ productId: product.id })),
    )
  ).flat();
  const uniqueReviews = [
    ...new Map(reviews.map((review) => [review.id, review])).values(),
  ];
  const rating = summarizeRatings(uniqueReviews);

  return (
    <>
      <KitLanding
        variants={variants.map(({ product, ...color }) => ({
          ...color,
          id: product.id,
          name: product.name,
          price: product.price,
          oldPrice: product.oldPrice,
          images: product.images,
          stock: product.stockAvailable,
          ozonSku: product.ozonSku,
        }))}
        catalogUnavailable={status === "unavailable"}
      >
        <section
          className="bg-sand px-5 py-16 lg:py-24"
          aria-labelledby="why-title"
        >
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-20">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-parchment">
              <Image
                src="/images/elka/weaving-tree.webp"
                alt="Крупный план плетения ёлки макраме"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div>
              <p className="label-caps mb-3 text-terracotta">
                Я рядом на каждом узле
              </p>
              <h2
                id="why-title"
                className="font-serif text-4xl leading-tight text-espresso md:text-5xl"
              >
                Получится, даже если вы никогда не плели
              </h2>
              <div className="mt-8 space-y-6 text-dark-grey">
                <p>
                  <strong className="block text-espresso">
                    Всего три базовых узла
                  </strong>
                  В видеоуроке на 2 часа 20 минут я показываю каждый шаг крупным
                  планом. Ставьте на паузу и пересматривайте — доступ остаётся
                  навсегда.
                </p>
                <p>
                  <strong className="block text-espresso">
                    Поддержка в Telegram
                  </strong>
                  Если узел не выходит, пришлите фото в чат участниц. Я помогу
                  его поправить.
                </p>
                <p>
                  <strong className="block text-espresso">
                    Из маленькой коробки — ёлка больше метра
                  </strong>
                  Готовая ёлка 50×110 см не занимает пол и не осыпается. Похожая
                  готовая работа стоит от 3 500 ₽.
                </p>
              </div>
              <p className="mt-7 font-serif text-xl italic text-espresso">
                С теплом, Ольга · плету макраме с 2018 года
              </p>
            </div>
          </div>
        </section>

        <section
          className="bg-parchment px-5 py-16 lg:py-24"
          aria-labelledby="box-title"
        >
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="label-caps mb-3 text-terracotta">Всё уже собрано</p>
              <h2
                id="box-title"
                className="font-serif text-4xl text-espresso md:text-5xl"
              >
                Что внутри коробки
              </h2>
              <ul className="mt-7 list-inside list-disc space-y-3 text-dark-grey">
                <li>100 м хлопкового шнура 5 мм</li>
                <li>Деревянная палочка-основа</li>
                <li>Деревянные бусины и звезда на макушку</li>
                <li>Карточка с QR-кодом к уроку и чату</li>
              </ul>
              <p className="mt-8 rounded-2xl bg-sand p-5 text-sm leading-relaxed text-espresso">
                Дома понадобятся только ножницы, сантиметровая лента и малярный
                скотч. Коробка 58×12×4 см сразу готова под подарок.
              </p>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-sand">
              <Image
                src="/images/elka/workshop.png"
                alt="Материалы и процесс плетения ёлки макраме"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {uniqueReviews.length > 0 && (
          <section
            className="bg-sand px-5 py-16 lg:py-24"
            aria-labelledby="kit-reviews"
          >
            <div className="mx-auto max-w-6xl">
              <p className="label-caps mb-3 text-terracotta">
                Опыт покупательниц
              </p>
              <h2
                id="kit-reviews"
                className="font-serif text-4xl text-espresso md:text-5xl"
              >
                Отзывы о наборах
              </h2>
              {rating && (
                <div className="mt-7">
                  <RatingPanel summary={rating} />
                </div>
              )}
              <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {uniqueReviews.slice(0, 3).map((review, index) => (
                  <ReviewCard key={review.id} review={review} index={index} />
                ))}
              </div>
            </div>
          </section>
        )}
      </KitLanding>
      <section
        className="bg-parchment px-5 py-16 lg:py-24"
        aria-labelledby="faq-title"
      >
        <div className="mx-auto max-w-4xl">
          <p className="label-caps mb-3 text-terracotta">Частые вопросы</p>
          <h2
            id="faq-title"
            className="font-serif text-4xl text-espresso md:text-5xl"
          >
            Перед первым узлом
          </h2>
          <div className="mt-8 divide-y divide-espresso/10 border-y border-espresso/10">
            {FAQ.map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="flex cursor-pointer list-none justify-between gap-4 text-lg text-espresso [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span className="text-terracotta group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="pt-3 leading-relaxed text-dark-grey">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <footer className="bg-espresso px-5 py-10 text-sm text-parchment">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-7">
          <div>
            <p className="font-serif text-2xl">Stariva</p>
            <p className="mt-2 text-parchment/70">
              {SELLER.shortName} · ИНН {SELLER.inn}
            </p>
          </div>
          <nav
            aria-label="Контакты и документы"
            className="flex flex-wrap gap-x-6 gap-y-3"
          >
            <a href={CONTACTS.telegramUrl}>Telegram</a>
            <a href={CONTACTS.whatsappUrl}>WhatsApp</a>
            <a href="/offer">Оферта</a>
            <a href="/privacy-policy">Политика конфиденциальности</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
