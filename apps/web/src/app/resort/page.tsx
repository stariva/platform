import type { Metadata } from "next";
import { B2BFormat } from "@/app/b2b/_components/b2b-format";
import { B2BOrder } from "@/app/b2b/_components/b2b-order";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { BreadcrumbJsonLd } from "@/components/stariva/json-ld";
import { Reviews } from "@/components/stariva/reviews";
import { BULK_DISCOUNT, MAX_ORDER_ITEMS } from "@/lib/b2b/order";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { ResortAdvantages } from "./_components/resort-advantages";
import { ResortContactStrip } from "./_components/resort-contact-strip";
import { ResortCtaDownload } from "./_components/resort-cta-download";
import { ResortFaq } from "./_components/resort-faq";
import { ResortHero } from "./_components/resort-hero";
import { ResortProcess } from "./_components/resort-process";
import { ResortScenarios } from "./_components/resort-scenarios";
import { RESORT_PLACE_TYPES } from "./_data";

export const metadata: Metadata = {
  title: "Макраме для баз отдыха и глэмпингов",
  description: `Абажуры, панно и кашпо из хлопка для баз отдыха, глэмпингов и загородных отелей: от 1 до ${MAX_ORDER_ITEMS} изделий, скидка ${BULK_DISCOUNT.percent}% от ${BULK_DISCOUNT.minItems} штук. Заказ по фото, без выезда, доставка по России.`,
  alternates: { canonical: `${BASE_URL}/resort` },
  openGraph: {
    type: "website",
    title: "Макраме для баз отдыха — Stariva",
    description: `Абажуры, панно и кашпо для домиков, веранд и ресепшна. До ${MAX_ORDER_ITEMS} изделий в одном стиле, заказ по фото, чек НПД.`,
    url: `${BASE_URL}/resort`,
    images: [
      {
        url: `https://cdn.stariva.ru/site/images/resort/hero-lake.webp`,
        width: 1848,
        height: 851,
        alt: "Макраме-декор для баз отдыха — Stariva",
      },
    ],
  },
};

export default function ResortPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Для бизнеса", href: "/b2b" },
          { name: "Базы отдыха", href: "/resort" },
        ]}
      />

      <Header variant="transparent" />

      <ResortHero />
      <ResortScenarios />
      <ResortAdvantages />
      <ResortProcess />
      <B2BFormat />
      <div className="bg-parchment">
        <B2BOrder
          source="resort_order"
          placeTypes={RESORT_PLACE_TYPES}
          defaultQuantities={{ panel: 3, lampshade: 3 }}
        />
      </div>
      <ResortCtaDownload />
      <ResortFaq />
      <Reviews limit={3} heading="Нас выбирают — и возвращаются" />
      <ResortContactStrip />

      <Footer />
    </>
  );
}
