import type { Metadata } from "next";
import { ElkaCustomerLooks } from "@/components/stariva/elka-customer-looks";
import { ElkaFaq } from "@/components/stariva/elka-faq";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import {
  BreadcrumbJsonLd,
  FAQJsonLd,
  ItemListJsonLd,
} from "@/components/stariva/json-ld";
import { Reviews } from "@/components/stariva/reviews";
import { TREES_PATH } from "@/lib/elka/data";
import { loadElkaData } from "@/lib/elka/load";
import { madeToOrderLeadTimeOf } from "@/lib/made-to-order";
import { productHref } from "@/lib/products";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { ElkaAudiences } from "./_components/elka-audiences";
import { ElkaBusiness } from "./_components/elka-business";
import { ElkaComparison } from "./_components/elka-comparison";
import { ElkaDiy } from "./_components/elka-diy";
import { ElkaHero } from "./_components/elka-hero";
import { ElkaModels } from "./_components/elka-models";
import { buildFaq, businessPoints, TREES_MODELS_ID } from "./_data";

// Цены и наличие ёлок и цена мастер-класса — из базы.
export const dynamic = "force-dynamic";

const TITLE = "Ёлка макраме на стену — купить новогоднюю ёлку-панно | Stariva";
const DESCRIPTION =
  "Новогодняя ёлка-панно в технике макраме ручной работы для квартиры, отеля, ресторана и офиса. Не осыпается, не занимает места, служит годами. Плетётся под заказ, доставка по России.";

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
      "Новогодняя ёлка-панно ручной работы для дома и бизнеса. Не осыпается, служит годами, плетётся под заказ.",
    url: `${BASE_URL}${TREES_PATH}`,
    images: [
      {
        url: "/images/elka/elka-cream-interior.jpg",
        alt: "Ёлка макраме со звездой на стене над комодом",
      },
    ],
  },
};

export default async function ElkaTreesPage() {
  const { trees: treesResult, workshop } = await loadElkaData("elka_trees");
  const trees = treesResult.products;
  const reviewProductId = trees[0]?.id;
  const faq = buildFaq(trees);

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
        items={trees.map((product) => ({
          name: product.name,
          url: productHref(product),
          image: product.images[0],
        }))}
      />
      <FAQJsonLd items={faq} />

      <Header variant="solid" />
      <main>
        <ElkaHero leadTime={madeToOrderLeadTimeOf(trees)} />
        <ElkaModels
          trees={trees}
          unavailable={treesResult.status === "unavailable"}
        />
        <ElkaCustomerLooks
          source="elka_trees"
          eyebrow="Фото покупателей"
          title="Ёлки макраме у покупателей дома"
          intro="Одна ёлка — сколько угодно нарядов: игрушки, гирлянда, флажки или совсем ничего. Её можно каждый год украшать по-новому."
          cta={{
            href: `#${TREES_MODELS_ID}`,
            label: "Выбрать ёлку",
            goal: "elka_looks_models",
          }}
        />
        <ElkaAudiences />
        <ElkaComparison />
        <ElkaBusiness points={businessPoints(trees)} />
        <Reviews
          limit={3}
          productId={reviewProductId}
          heading="Отзывы покупателей Stariva"
        />
        <ElkaDiy workshop={workshop} />
        <ElkaFaq
          items={faq}
          title="Частые вопросы о ёлке макраме"
          message="Здравствуйте, Ольга! У меня вопрос про ёлку макраме."
          source="elka_trees_faq"
        />
      </main>
      <Footer />
    </>
  );
}
