import type { Metadata } from "next";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/stariva/json-ld";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { DesignerBrief } from "./_components/designer-brief";
import { DesignersAssortment } from "./_components/designers-assortment";
import { DesignersChecklist } from "./_components/designers-checklist";
import { DesignersContact } from "./_components/designers-contact";
import { DesignersFaq } from "./_components/designers-faq";
import { DesignersHero } from "./_components/designers-hero";
import { DesignersProcess } from "./_components/designers-process";
import { DesignersTerms } from "./_components/designers-terms";
import { faq } from "./_data";

const ogImage =
  "https://cdn.stariva.ru/site/images/b2b/project-restaurant-editorial.webp";

export const metadata: Metadata = {
  title: "Дизайнерам интерьера — макраме для кафе, ресторанов и отелей",
  description:
    "Условия для дизайнеров интерьера: скидка с первого изделия, абажуры, панно и перегородки макраме под проект, расчёт для сметы за 2 рабочих дня и бриф онлайн.",
  alternates: { canonical: `${BASE_URL}/designers` },
  openGraph: {
    type: "website",
    title: "Дизайнерам интерьера — Stariva",
    description:
      "Макраме ручного плетения для общественных интерьеров на условиях партнёра: скидка дизайнера, образец в цвете проекта, документы для бухгалтерии.",
    url: `${BASE_URL}/designers`,
    images: [
      {
        url: ogImage,
        width: 1536,
        height: 1024,
        alt: "Плетёная перегородка из хлопка в интерьере ресторана",
      },
    ],
  },
};

export default function DesignersPage() {
  return (
    <div className="bg-parchment text-espresso pt-[60px] lg:pt-[68px]">
      <Header variant="solid" />
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Для бизнеса", href: "/b2b" },
          { name: "Дизайнерам интерьера", href: "/designers" },
        ]}
      />
      <FAQJsonLd
        items={faq.map((item) => ({ question: item.q, answer: item.a }))}
      />

      <DesignersHero />
      <DesignersTerms />
      <DesignersAssortment />
      <DesignersChecklist />
      <DesignersProcess />
      <DesignerBrief />
      <DesignersFaq />
      <DesignersContact />

      <Footer />
    </div>
  );
}
