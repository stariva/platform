import type { Metadata } from "next";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { BreadcrumbJsonLd } from "@/components/stariva/json-ld";
import { Reviews } from "@/components/stariva/reviews";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { PhotoshootsFaq } from "./_components/photoshoots-faq";
import { PhotoshootsHero } from "./_components/photoshoots-hero";
import { PhotoshootsProcess } from "./_components/photoshoots-process";
import { PhotoshootsScenarios } from "./_components/photoshoots-scenarios";

export const metadata: Metadata = {
  title: "Платья макраме для фотосессий: Марокко, свадьба, море — Stariva",
  description:
    "Платья и туники макраме ручной работы для фотосессий в путешествиях и на свадьбах: Марокко, бохо-свадьба у моря, острова, пустыня. Подбор образа и пошив по меркам.",
  alternates: { canonical: `${BASE_URL}/photoshoots` },
  openGraph: {
    type: "website",
    title: "Платья макраме для фотосессий — Stariva",
    description:
      "Образы в технике макраме для съёмок в Марокко, на свадьбе у моря и в путешествиях. Ручная работа по вашим меркам.",
    url: `${BASE_URL}/photoshoots`,
    images: [
      {
        url: "/images/photoshoots/hero-morocco.png",
        alt: "Дюны Сахары на закате — фотосессии в платьях макраме Stariva",
      },
    ],
  },
};

export default function PhotoshootsPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Одежда", href: "/catalog/clothes" },
          { name: "Для фотосессий", href: "/photoshoots" },
        ]}
      />

      <Header variant="transparent" />

      <main>
        <PhotoshootsHero />
        <PhotoshootsScenarios />
        <PhotoshootsProcess />
        <Reviews limit={3} heading="Что говорят после поездок" />
        <PhotoshootsFaq />
      </main>

      <Footer />
    </>
  );
}
