import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
import { BIG_TREE_PATH, BONUS_TREE_SIZE, WORKSHOP_PATH } from "@/lib/elka/data";
import { getTreeProducts, loadBigTreeWorkshop } from "@/lib/elka/load";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { BigTreeWorkshop } from "./_components/big-tree-workshop";
import { BUY_ID, bigTreeFaq } from "./_data";

// Как у маленькой ёлки: цена и старт живые, а при сборке образа базы нет.
export const dynamic = "force-dynamic";

const TITLE =
  "Большая ёлка макраме своими руками — мастер-класс в видеоуроках | Stariva";
const DESCRIPTION = `Сплетите настенную ёлку макраме ${BONUS_TREE_SIZE} по пошаговым видеоурокам Ольги: расчёт шнура, узлы, крона и бахрома. Для начинающих, доступ навсегда.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
    "большая ёлка макраме",
    "ёлка макраме своими руками",
    "ёлка макраме на стену",
    "мастер-класс ёлка макраме",
    "ёлка макраме 150 см",
  ],
  alternates: { canonical: `${BASE_URL}${BIG_TREE_PATH}` },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    title: "Большая ёлка макраме своими руками — мастер-класс Stariva",
    description: DESCRIPTION,
    url: `${BASE_URL}${BIG_TREE_PATH}`,
    images: [
      {
        url: "https://cdn.stariva.ru/workshops/elka-makrame-bolshaya/d0559bcbb001b10b.png",
        alt: `Ольга рядом с большой ёлкой макраме ${BONUS_TREE_SIZE} на стене`,
      },
    ],
  },
};

/** Ёлки в полтора метра — их и сравниваем с ценой уроков. */
const BIG_TREE_HEIGHT = /150/;

export default async function ElkaMakrameBolshayaPage() {
  const [bigTree, { products: trees }] = await Promise.all([
    loadBigTreeWorkshop(),
    getTreeProducts(),
  ]);
  // Пока курс не продаётся или база недоступна — на лендинг маленькой ёлки,
  // там тоже можно купить, а рекламный клик не упрётся в пустую страницу.
  if (!bigTree) redirect(WORKSHOP_PATH);

  const bigTrees = trees.filter((tree) =>
    BIG_TREE_HEIGHT.test(tree.dimensions ?? ""),
  );
  const prices = bigTrees.map((tree) => tree.price).filter((p) => p > 0);
  const readyTreePrice = prices.length > 0 ? Math.min(...prices) : undefined;
  const faq = bigTreeFaq(bigTree);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Мастер-классы", href: "/workshops" },
          { name: "Большая ёлка макраме", href: BIG_TREE_PATH },
        ]}
      />
      <FAQJsonLd items={faq} />
      <CourseJsonLd
        name={bigTree.title}
        description={bigTree.subtitle}
        image={bigTree.cover}
        price={bigTree.price}
        url={BIG_TREE_PATH}
        duration={bigTree.duration}
        level={bigTree.level}
        lessonsCount={bigTree.lessonsCount}
      />

      <Header variant="solid" />
      <main>
        <BigTreeWorkshop workshop={bigTree} readyTreePrice={readyTreePrice} />
        <ElkaCustomerLooks
          source="elka_big"
          eyebrow="Идеи для украшения"
          title="Как наряжают ёлку макраме покупатели"
          intro="Так готовые ёлки Stariva выглядят дома у покупателей. Ёлку, которую вы сплетёте сами, тоже можно каждый год украшать по-новому."
          cta={{
            href: `#${BUY_ID}`,
            label: "Хочу сплести такую",
            goal: "elka_big_looks_workshop",
          }}
        />
        <Reviews
          limit={3}
          productId={bigTrees[0]?.id ?? trees[0]?.id}
          heading="Отзывы покупателей Stariva"
        />
        <ElkaFaq
          items={faq}
          title="Частые вопросы о мастер-классе"
          message="Здравствуйте, Ольга! У меня вопрос про мастер-класс по большой ёлке макраме."
          source="elka_big_faq"
        />
      </main>
      <Footer />
    </>
  );
}
