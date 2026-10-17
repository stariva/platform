import type { Metadata } from "next";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/stariva/json-ld";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { PartnersFaq } from "./_components/partners-faq";
import { PartnersHero } from "./_components/partners-hero";
import { PartnersProcess } from "./_components/partners-process";
import { faq, PARTNER_TERMS } from "./_data";

export const metadata: Metadata = {
  title: "Партнёрам: 10% за приведённых клиентов",
  description: `Рекомендуйте изделия макраме ручной работы Stariva и получайте ${PARTNER_TERMS.referralReward} с каждого оплаченного заказа. Без анкет и договоров — просто напишите Ольге.`,
  alternates: { canonical: `${BASE_URL}/partners` },
  openGraph: {
    type: "website",
    title: "Партнёрам — Stariva",
    description: `Приводите клиентов и получайте ${PARTNER_TERMS.referralReward} с заказа.`,
    url: `${BASE_URL}/partners`,
    images: [
      {
        url: "/images/photoshoots/wedding-sea.png",
        alt: "Свадебная арка с макраме на пляже — Stariva",
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
          { name: "Партнёрам", href: "/partners" },
        ]}
      />
      <FAQJsonLd
        items={faq.map((item) => ({ question: item.q, answer: item.a }))}
      />

      <Header variant="transparent" />

      <main>
        <PartnersHero />
        <PartnersProcess />
        <PartnersFaq />
      </main>

      <Footer />
    </>
  );
}
