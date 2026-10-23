import type { Metadata } from "next";
import { ElkaCustomerLooks } from "@/components/stariva/elka-customer-looks";
import { ElkaFaq } from "@/components/stariva/elka-faq";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import {
  BreadcrumbJsonLd,
  CourseJsonLd,
  FAQJsonLd,
} from "@/components/stariva/json-ld";
import { Reviews } from "@/components/stariva/reviews";
import { WORKSHOP_PATH, WORKSHOP_SLUG } from "@/lib/elka/data";
import { loadBigTreeWorkshop, loadElkaData } from "@/lib/elka/load";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { getWorkshopBySlug } from "@/lib/workshops/workshops-db";
import { ElkaReadyTrees } from "./_components/elka-ready-trees";
import { ElkaWorkshop, workshopOffer } from "./_components/elka-workshop";
import { LegacyModelsRedirect } from "./_components/legacy-models-redirect";
import { WORKSHOP_BUY_ID, workshopFaq } from "./_data";

// Рендер на каждый запрос: при сборке образа базы нет, и статическая
// страница запекалась без мастер-класса (кнопка «связаться» вместо оплаты)
// на час после каждого деплоя. Цена предзаказа и цены ёлок тоже живые.
export const dynamic = "force-dynamic";

const TITLE =
  "Ёлка макраме своими руками — мастер-класс в видеоуроках | Stariva";
const COVER =
  "https://cdn.stariva.ru/site/images/elka/masterclass-elka-makrame-mk.webp";

/** Последняя фраза описания: до старта — про подарок, после — про уроки. */
function offerSentence(preorder: boolean): string {
  return preorder
    ? "Предзаказ со скидкой и второй мастер-класс — в подарок."
    : "Уроки уже открыты — начните сразу после оплаты.";
}

export async function generateMetadata(): Promise<Metadata> {
  // Сбой базы не должен ронять страницу: описание возьмёт запасную дату.
  const workshop = await getWorkshopBySlug(WORKSHOP_SLUG).catch(
    () => undefined,
  );
  const offer = offerSentence(workshopOffer(workshop).preorder);
  return {
    ...METADATA,
    description: `Сплетите настенную ёлку макраме 50 × 110 см по пошаговым видеоурокам: схема и расчёт шнура, доступ навсегда, обратная связь от мастера. ${offer}`,
    openGraph: {
      ...METADATA.openGraph,
      description: `Сплетите настенную ёлку макраме по пошаговым видеоурокам. ${offer}`,
    },
  };
}

const METADATA: Metadata = {
  title: { absolute: TITLE },
  keywords: [
    "мастер-класс ёлка макраме",
    "ёлка макраме своими руками",
    "ёлка из макраме своими руками",
    "онлайн-мастер-класс макраме",
    "ёлка из макраме",
    "ёлка макраме на стену",
    "новогоднее панно макраме",
  ],
  alternates: { canonical: `${BASE_URL}${WORKSHOP_PATH}` },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    title: "Ёлка макраме своими руками — мастер-класс Stariva",
    url: `${BASE_URL}${WORKSHOP_PATH}`,
    images: [
      {
        url: COVER,
        alt: "Мастер Stariva украшает зелёную ёлку макраме на стене",
      },
    ],
  },
};

export default async function ElkaMakramePage() {
  const [{ trees: treesResult, workshop }, bigTree] = await Promise.all([
    loadElkaData("elka_workshop"),
    loadBigTreeWorkshop(),
  ]);
  const trees = treesResult.products;
  const reviewProductId = trees[0]?.id;
  const treePrices = trees.map((tree) => tree.price).filter((p) => p > 0);
  const readyTreePrice =
    treePrices.length > 0 ? Math.min(...treePrices) : undefined;
  const { preorder, releaseLabel } = workshopOffer(workshop);
  const faq = workshopFaq({ preorder, releaseLabel, bigTree });

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Мастер-классы", href: "/workshops" },
          { name: "Ёлка макраме", href: WORKSHOP_PATH },
        ]}
      />
      <FAQJsonLd items={faq} />
      {workshop ? (
        <CourseJsonLd
          name={workshop.title}
          description={workshop.subtitle}
          image={workshop.cover}
          price={workshop.price}
          url={WORKSHOP_PATH}
          duration={workshop.duration}
          level={workshop.level}
          lessonsCount={workshop.lessonsCount}
        />
      ) : null}

      <Header variant="solid" />
      <main>
        <ElkaWorkshop
          workshop={workshop}
          bigTree={bigTree}
          readyTreePrice={readyTreePrice}
        />
        <ElkaCustomerLooks
          source="elka_workshop"
          eyebrow="Идеи для украшения"
          title="Как наряжают ёлку макраме покупатели"
          intro="Так готовые ёлки Stariva выглядят дома у покупателей. Ёлку, которую вы сплетёте сами, тоже можно каждый год украшать по-новому."
          cta={{
            href: `#${WORKSHOP_BUY_ID}`,
            label: "Хочу сплести такую",
            goal: "elka_looks_workshop",
          }}
        />
        <Reviews
          limit={3}
          productId={reviewProductId}
          heading="Отзывы покупателей Stariva"
        />
        <ElkaFaq
          items={faq}
          title="Частые вопросы о мастер-классе"
          message="Здравствуйте, Ольга! У меня вопрос про мастер-класс по ёлке макраме."
          source="elka_faq"
        />
        <ElkaReadyTrees trees={trees} />
        <LegacyModelsRedirect />
      </main>
      <Footer />
    </>
  );
}
