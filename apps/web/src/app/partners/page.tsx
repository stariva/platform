import type { Metadata } from "next";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/stariva/json-ld";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { PartnersApply } from "./_components/partners-apply";
import { PartnersAudiences } from "./_components/partners-audiences";
import { PartnersFaq } from "./_components/partners-faq";
import { PartnersFormats } from "./_components/partners-formats";
import { PartnersHero } from "./_components/partners-hero";
import { PartnersLooks } from "./_components/partners-looks";
import { PartnersProcess } from "./_components/partners-process";
import { faq, PARTNER_TERMS } from "./_data";

export const metadata: Metadata = {
  title: "Фотографам и стилистам — партнёрская программа Stariva",
  description: `Платья макраме ручной работы для съёмок ваших клиенток. Вознаграждение ${PARTNER_TERMS.referralReward} за рекомендацию, скидка ${PARTNER_TERMS.volumeDiscount} на заказ от ${PARTNER_TERMS.volumeFrom} изделий, коллаборации для editorial-съёмок.`,
  alternates: { canonical: `${BASE_URL}/partners` },
  openGraph: {
    type: "website",
    title: "Фотографам и стилистам — Stariva",
    description:
      "Платья макраме для съёмок: партнёрская ссылка, заказы для клиенток и студий, совместные съёмки.",
    url: `${BASE_URL}/partners`,
    images: [
      {
        url: "/images/photoshoots/wedding-sea.png",
        alt: "Свадебная арка с макраме на пляже — партнёрская программа Stariva",
      },
    ],
  },
};

export default function PartnersPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Фотографам и стилистам", href: "/partners" },
        ]}
      />
      <FAQJsonLd
        items={faq.map((item) => ({ question: item.q, answer: item.a }))}
      />

      <Header variant="transparent" />

      <main>
        <PartnersHero />
        <PartnersAudiences />
        <PartnersFormats />
        <PartnersLooks />
        <PartnersProcess />
        <PartnersApply />
        <PartnersFaq />
      </main>

      <Footer />
    </>
  );
}
