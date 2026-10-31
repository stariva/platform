import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ElkaFaq } from "@/components/stariva/elka-faq";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import {
  BreadcrumbJsonLd,
  FAQJsonLd,
  ItemListJsonLd,
} from "@/components/stariva/json-ld";
import { Reviews } from "@/components/stariva/reviews";
import { getProductsResult } from "@/lib/catalog/service";
import { productHref } from "@/lib/products";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { GnomesCards } from "./_components/gnomes-cards";
import { GnomesHero } from "./_components/gnomes-hero";
import { GnomesIdeas } from "./_components/gnomes-ideas";
import {
  GNOMES_PATH,
  gnomeList,
  gnomesFaq,
  pairButtonLabel,
  pairOffer,
  pickGnomes,
} from "./_data";

// Цены и наличие гномов — из базы, при сборке образа её нет.
export const dynamic = "force-dynamic";

const TITLE =
  "Два вязаных гнома — Тыква и Мухомор, интерьерный декор ручной работы | Stariva";
const DESCRIPTION =
  "Пара гномов ручной вязки из плюшевой пряжи, 40–45 см: осенний и новогодний декор для полки, подоконника или комода. В наличии, отправим за 1–2 дня, доставка Ozon по России.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
    "вязаный гном",
    "гном интерьерный",
    "гномы осенний декор",
    "новогодний гном",
    "гном томте",
    "купить вязаного гнома",
  ],
  alternates: { canonical: `${BASE_URL}${GNOMES_PATH}` },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    title: "Два вязаных гнома — Тыква и Мухомор — Stariva",
    description: DESCRIPTION,
    url: `${BASE_URL}${GNOMES_PATH}`,
  },
};

export default async function GnomesPage() {
  const { products } = await getProductsResult();
  const gnomes = gnomeList(pickGnomes(products));
  // Гномов нет в каталоге или база недоступна — в раздел декора: рекламный
  // клик не упрётся в пустую страницу.
  if (gnomes.length === 0) redirect("/catalog/interior");

  const offer = pairOffer(gnomes);
  const faq = gnomesFaq(gnomes);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Интерьер", href: "/catalog/interior" },
          { name: "Два вязаных гнома", href: GNOMES_PATH },
        ]}
      />
      <ItemListJsonLd
        name="Вязаные гномы Тыква и Мухомор"
        url={GNOMES_PATH}
        items={gnomes.map((product) => ({
          name: product.name,
          url: productHref(product),
          image: product.images[0],
        }))}
      />
      <FAQJsonLd items={faq} />

      <Header variant="solid" />
      <main>
        <GnomesHero gnomes={gnomes} offer={offer} />
        <GnomesCards gnomes={gnomes} />
        <GnomesIdeas
          available={offer.available}
          label={pairButtonLabel(offer)}
        />
        <Reviews
          limit={3}
          productId={gnomes[0]?.id}
          heading="Отзывы покупателей Stariva"
        />
        <ElkaFaq
          items={faq}
          title="Частые вопросы о гномах"
          message="Здравствуйте, Ольга! У меня вопрос про вязаных гномов."
          source="gnomes_faq"
        />
      </main>
      <Footer />
    </>
  );
}
