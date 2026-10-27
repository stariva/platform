import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ElkaCustomerLooks } from "@/components/stariva/elka-customer-looks";
import { ElkaFaq } from "@/components/stariva/elka-faq";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/stariva/json-ld";
import { Reviews } from "@/components/stariva/reviews";
import {
  BONUS_TREE_SIZE,
  WORKSHOP_PATH,
  WORKSHOP_TREE_SIZE,
} from "@/lib/elka/data";
import { getTreeProducts } from "@/lib/elka/load";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { getBundle } from "@/lib/workshops/bundles";
import { getWorkshopBySlug } from "@/lib/workshops/workshops-db";
import { KomboOffer } from "./_components/kombo-offer";
import { BUY_ID, KOMBO_SLUG, komboFaq } from "./_data";

// Как у других ёлок: цены курсов живые, а при сборке образа базы нет.
export const dynamic = "force-dynamic";

const PATH = "/elka-makrame-kombo";
const TITLE =
  "Две ёлки макраме своими руками — комбо из 2 мастер-классов | Stariva";
const DESCRIPTION = `Два мастер-класса в видеоуроках одним заказом: ёлка макраме ${WORKSHOP_TREE_SIZE} и большая ${BONUS_TREE_SIZE}. Схемы и расчёт шнура, для начинающих, доступ навсегда.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
    "ёлка макраме мастер-класс",
    "ёлка макраме своими руками",
    "мастер-класс макраме ёлка на стену",
    "большая ёлка макраме",
  ],
  alternates: { canonical: `${BASE_URL}${PATH}` },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    title: "Две ёлки макраме своими руками — комбо мастер-классов Stariva",
    description: DESCRIPTION,
    url: `${BASE_URL}${PATH}`,
    images: [
      {
        url: "https://cdn.stariva.ru/site/images/elka/masterclass-elka-makrame-mk.webp",
        alt: "Ёлка макраме на стене — комбо мастер-классов Stariva",
      },
    ],
  },
};

export default async function ElkaMakrameKomboPage() {
  const bundle = getBundle(KOMBO_SLUG);
  const bigSlug = bundle?.extras[0]?.slug;
  const [small, big, { products: trees }] = await Promise.all([
    bundle ? getWorkshopBySlug(bundle.main).catch(() => undefined) : undefined,
    bigSlug ? getWorkshopBySlug(bigSlug).catch(() => undefined) : undefined,
    getTreeProducts(),
  ]);
  // Один из курсов не продаётся или база недоступна — на лендинг маленькой
  // ёлки: там тоже можно купить, а рекламный клик не упрётся в пустую страницу.
  if (!bundle || !small || !big) redirect(WORKSHOP_PATH);

  const faq = komboFaq(bundle, small, big);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Мастер-классы", href: "/workshops" },
          { name: "Комбо: две ёлки макраме", href: PATH },
        ]}
      />
      <FAQJsonLd items={faq} />

      <Header variant="solid" />
      <main>
        <KomboOffer bundle={bundle} small={small} big={big} />
        <ElkaCustomerLooks
          source="elka_kombo"
          eyebrow="Идеи для украшения"
          title="Как наряжают ёлку макраме покупатели"
          intro="Так готовые ёлки Stariva выглядят дома у покупателей. Ёлки, которые вы сплетёте сами, тоже можно каждый год украшать по-новому."
          cta={{
            href: `#${BUY_ID}`,
            label: "Хочу сплести такие",
            goal: "elka_kombo_looks_workshop",
          }}
        />
        <Reviews
          limit={3}
          productId={trees[0]?.id}
          heading="Отзывы покупателей Stariva"
        />
        <ElkaFaq
          items={faq}
          title="Частые вопросы о комбо"
          message="Здравствуйте, Ольга! У меня вопрос про комбо мастер-классов по ёлкам макраме."
          source="elka_kombo_faq"
        />
      </main>
      <Footer />
    </>
  );
}
