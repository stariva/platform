import { logger } from "@stariva/config";
import type { Metadata } from "next";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import {
  BreadcrumbJsonLd,
  CourseJsonLd,
  FAQJsonLd,
} from "@/components/stariva/json-ld";
import { Reviews } from "@/components/stariva/reviews";
import { getProductBySlug } from "@/lib/ozon-service";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { getWorkshopBySlug } from "@/lib/workshops/workshops-db";
import { ElkaFaq } from "./_components/elka-faq";
import { ElkaReadyTrees } from "./_components/elka-ready-trees";
import { ElkaWorkshop } from "./_components/elka-workshop";
import { FAQ, LANDING_PATH, TREE_MODELS, WORKSHOP_SLUG } from "./_data";

// Рендер на каждый запрос: при сборке образа базы нет, и статическая
// страница запекалась без мастер-класса (кнопка «связаться» вместо оплаты)
// на час после каждого деплоя. Цена предзаказа и цены ёлок тоже живые.
export const dynamic = "force-dynamic";

const TITLE =
  "Ёлка макраме своими руками — мастер-класс в видеоуроках | Stariva";
const DESCRIPTION =
  "Сплетите настенную ёлку макраме 50 × 110 см по пошаговым видеоурокам: схема и расчёт шнура, доступ навсегда, обратная связь от мастера. Предзаказ со скидкой и второй мастер-класс — в подарок.";
const COVER =
  "https://cdn.stariva.ru/site/images/elka/masterclass-elka-makrame.webp";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
    "мастер-класс ёлка макраме",
    "ёлка макраме своими руками",
    "ёлка из макраме своими руками",
    "онлайн-мастер-класс макраме",
    "ёлка из макраме",
    "ёлка макраме на стену",
    "новогоднее панно макраме",
  ],
  alternates: { canonical: `${BASE_URL}${LANDING_PATH}` },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    title: "Ёлка макраме своими руками — мастер-класс Stariva",
    description:
      "Сплетите настенную ёлку макраме по пошаговым видеоурокам. Предзаказ со скидкой и второй мастер-класс — в подарок.",
    url: `${BASE_URL}${LANDING_PATH}`,
    images: [
      {
        url: COVER,
        alt: "Мастер Stariva украшает зелёную ёлку макраме на стене",
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
          { name: "Мастер-классы", href: "/workshops" },
          { name: "Ёлка макраме", href: LANDING_PATH },
        ]}
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
        <ElkaWorkshop workshop={workshop} />
        <Reviews
          limit={3}
          productId={reviewProductId}
          heading="Отзывы покупателей Stariva"
        />
        <ElkaFaq />
        <ElkaReadyTrees items={items} />
      </main>
      <Footer />
    </>
  );
}
