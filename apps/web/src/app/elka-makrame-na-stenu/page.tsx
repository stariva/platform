import { logger } from "@stariva/config";
import type { Metadata } from "next";
import { ElkaFaq } from "@/app/elka-makrame/_components/elka-faq";
import { WORKSHOP_SLUG } from "@/app/elka-makrame/_data";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import {
  BreadcrumbJsonLd,
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
import { ElkaDiy } from "./_components/elka-diy";
import { ElkaHero } from "./_components/elka-hero";
import { ElkaModels } from "./_components/elka-models";
import { FAQ, TREE_MODELS, TREES_PATH } from "./_data";

// Цены и наличие ёлок живые (Ozon), цена мастер-класса — из базы.
export const dynamic = "force-dynamic";

const TITLE = "Ёлка макраме на стену — купить новогоднюю ёлку-панно | Stariva";
const DESCRIPTION =
  "Новогодняя ёлка-панно в технике макраме ручной работы для квартиры, отеля, ресторана и офиса. Не осыпается, не занимает места, служит годами. Под заказ за 2–3 дня, доставка по России.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
    "ёлка из макраме",
    "ёлка макраме на стену",
    "купить ёлку макраме",
    "новогоднее панно макраме",
    "ёлка на стену",
    "настенная ёлка",
    "новогодний декор для отеля",
    "новогоднее оформление ресторана",
  ],
  alternates: { canonical: `${BASE_URL}${TREES_PATH}` },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    title: "Ёлка макраме на стену — Stariva",
    description:
      "Новогодняя ёлка-панно ручной работы для дома и бизнеса. Не осыпается, служит годами, под заказ за 2–3 дня.",
    url: `${BASE_URL}${TREES_PATH}`,
    images: [
      {
        url: "/images/elka/elka-cream-interior.jpg",
        alt: "Ёлка макраме со звездой на стене над комодом",
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

export default async function ElkaTreesPage() {
  const { items, workshop } = await loadData();
  const reviewProductId = items.find((item) => item.product)?.product?.id;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Интерьер", href: "/catalog/interior" },
          { name: "Ёлка макраме на стену", href: TREES_PATH },
        ]}
      />
      <ItemListJsonLd
        name="Ёлки макраме на стену"
        url={TREES_PATH}
        items={items.map(({ model, product }) => ({
          name: model.name,
          url: model.href,
          image: product?.images[0] ?? `${BASE_URL}${model.fallbackImage}`,
        }))}
      />
      <FAQJsonLd items={FAQ} />

      <Header variant="solid" />
      <main>
        <ElkaHero />
        <ElkaModels items={items} />
        <ElkaAudiences />
        <ElkaComparison />
        <ElkaBusiness />
        <Reviews
          limit={3}
          productId={reviewProductId}
          heading="Отзывы покупателей Stariva"
        />
        <ElkaFaq
          items={FAQ}
          title="Частые вопросы о ёлке макраме"
          message="Здравствуйте, Ольга! У меня вопрос про ёлку макраме."
        />
        <ElkaDiy workshop={workshop} />
      </main>
      <Footer />
    </>
  );
}
