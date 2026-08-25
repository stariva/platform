import type { Metadata } from "next";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { BreadcrumbJsonLd } from "@/components/stariva/json-ld";
import { Reviews } from "@/components/stariva/reviews";
import { ResortAdvantages } from "./_components/resort-advantages";
import { ResortContactStrip } from "./_components/resort-contact-strip";
import { ResortCtaDownload } from "./_components/resort-cta-download";
import { ResortFaq } from "./_components/resort-faq";
import { ResortHero } from "./_components/resort-hero";
import { ResortProcess } from "./_components/resort-process";
import { ResortScenarios } from "./_components/resort-scenarios";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://stariva.ru";

export const metadata: Metadata = {
  title: "Макраме для баз отдыха и глэмпингов — Stariva",
  description:
    "Декор из макраме для баз отдыха, глэмпингов, загородных отелей и spa. Абажуры, панно, гамак-кресла, ширмы — корпоративные заказы с документами.",
  alternates: { canonical: `${BASE_URL}/resort` },
  openGraph: {
    type: "website",
    title: "Макраме для баз отдыха — Stariva",
    description:
      "Декор для баз отдыха, глэмпингов и загородных отелей. Натуральный хлопок, авторский дизайн, документы для бухгалтерии.",
    url: `${BASE_URL}/resort`,
    images: [
      {
        url: `${BASE_URL}/images/resort/hero.png`,
        width: 1200,
        height: 630,
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
      <ResortCtaDownload />
      <Reviews limit={3} heading="Нас выбирают — и возвращаются" />
      <ResortFaq />
      <ResortContactStrip />

      <Footer />
    </>
  );
}
