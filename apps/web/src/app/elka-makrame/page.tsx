import { logger } from "@stariva/config";
import type { Metadata } from "next";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import {
  BreadcrumbJsonLd,
  CourseJsonLd,
  FAQJsonLd,
  ItemListJsonLd,
} from "@/components/stariva/json-ld";
import { Reviews } from "@/components/stariva/reviews";
import { getProductBySlug } from "@/lib/ozon-service";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { getWorkshopBySlug } from "@/lib/workshops/workshops-db";
import { ElkaAudiences } from "./_components/elka-audiences";
import { ElkaBusiness } from "./_components/elka-business";
import { ElkaComparison } from "./_components/elka-comparison";
import { ElkaFaq } from "./_components/elka-faq";
import { ElkaHero } from "./_components/elka-hero";
import { ElkaModels } from "./_components/elka-models";
import { ElkaWorkshop } from "./_components/elka-workshop";
import { FAQ, LANDING_PATH, TREE_MODELS, WORKSHOP_SLUG } from "./_data";

// Рендер на каждый запрос: при сборке образа базы нет, и статическая
// страница запекалась без мастер-класса (кнопка «связаться» вместо оплаты)
// на час после каждого деплоя. Цена предзаказа и наличие ёлок тоже живые.
export const dynamic = "force-dynamic";

const TITLE = "Макраме-ёлка на стену — купить новогоднюю ёлку-панно | Stariva";
const DESCRIPTION =
  "Ёлка-панно в технике макраме ручной работы для квартиры, отеля, ресторана и офиса. Не осыпается, не занимает места, служит годами. Изготовление 2–3 дня, доставка по России. Мастер-класс по предзаказу со скидкой и второй — в подарок.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
    "ёлка из макраме",
    "ёлка макраме на стену",
    "новогоднее панно макраме",
    "ёлка на стену",
    "настенная ёлка",
    "новогодний декор для отеля",
    "новогоднее оформление ресторана",
    "мастер-класс ёлка макраме",
  ],
  alternates: { canonical: `${BASE_URL}${LANDING_PATH}` },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    title: "Макраме-ёлка на стену — Stariva",
    description:
      "Новогодняя ёлка-панно ручной работы для дома и бизнеса. Плюс мастер-класс по предзаказу со скидкой и второй — в подарок.",
    url: `${BASE_URL}${LANDING_PATH}`,
    images: [
      {
        url: "/images/elka/elka-cream-interior.jpg",
        alt: "Макраме-ёлка со звездой на стене над комодом",
      },
    ],
  },
};

async function loadData() {
  const [products, workshop] = await Promise.all([
    Promise.all(
      TREE_MODELS.map((model) =>
        getProductBySlug(model.slug).catch((error) => {
          logger.warn("elka.product.unavailable", {
            slug: model.slug,
            error: String(error),
          });
          return undefined;
        }),
      ),
    ),
    getWorkshopBySlug(WORKSHOP_SLUG).catch((error) => {
      logger.warn("elka.workshop.unavailable", { error: String(error) });
      return undefined;
    }),
  ]);

  return {
    items: TREE_MODELS.map((model, index) => ({
      model,
      product: products[index],
    })),
    workshop,
  };
}

export default async function ElkaMakramePage() {
  const { items, workshop } = await loadData();
  const reviewProductId = items.find((item) => item.product)?.product?.id;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Интерьер", href: "/catalog/interior" },
          { name: "Макраме-ёлка", href: LANDING_PATH },
        ]}
      />
      <ItemListJsonLd
        name="Макраме-ёлки на стену"
        url={LANDING_PATH}
        items={items.map(({ model, product }) => ({
          name: model.name,
          url: model.href,
          image: product?.images[0] ?? `${BASE_URL}${model.fallbackImage}`,
        }))}
      />
      <FAQJsonLd items={FAQ} />
      {workshop ? (
        <CourseJsonLd
          name={workshop.title}
          description={workshop.subtitle}
          image={workshop.cover}
          price={workshop.price}
          url={LANDING_PATH}
          duration={workshop.duration}
          level={workshop.level}
          lessonsCount={workshop.lessonsCount}
        />
      ) : null}

      <Header variant="solid" />
      <main>
        <ElkaHero />
        <ElkaModels items={items} />
        <ElkaAudiences />
        <ElkaComparison />
        <ElkaBusiness />
        <ElkaWorkshop workshop={workshop} />
        <Reviews
          limit={3}
          productId={reviewProductId}
          heading="Отзывы покупателей Stariva"
        />
        <ElkaFaq />
      </main>
      <Footer />
    </>
  );
}
