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
import { WORKSHOP_PATH } from "@/lib/elka/data";
import { loadElkaData } from "@/lib/elka/load";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { ElkaReadyTrees } from "./_components/elka-ready-trees";
import { ElkaWorkshop } from "./_components/elka-workshop";
import { LegacyModelsRedirect } from "./_components/legacy-models-redirect";
import { FAQ, WORKSHOP_BUY_ID } from "./_data";

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
  alternates: { canonical: `${BASE_URL}${WORKSHOP_PATH}` },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    title: "Ёлка макраме своими руками — мастер-класс Stariva",
    description:
      "Сплетите настенную ёлку макраме по пошаговым видеоурокам. Предзаказ со скидкой и второй мастер-класс — в подарок.",
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
  const { items, workshop } = await loadElkaData("elka_workshop");
  const reviewProductId = items.find((item) => item.product)?.product?.id;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Мастер-классы", href: "/workshops" },
          { name: "Ёлка макраме", href: WORKSHOP_PATH },
        ]}
      />
      <FAQJsonLd items={FAQ} />
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
        <ElkaWorkshop workshop={workshop} />
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
          items={FAQ}
          title="Частые вопросы о мастер-классе"
          message="Здравствуйте, Ольга! У меня вопрос про мастер-класс по ёлке макраме."
          source="elka_faq"
        />
        <ElkaReadyTrees items={items} />
        <LegacyModelsRedirect />
      </main>
      <Footer />
    </>
  );
}
