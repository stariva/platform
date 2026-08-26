import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import {
  BreadcrumbJsonLd,
  FAQJsonLd,
  ProductJsonLd,
} from "@/components/stariva/json-ld";
import { MobileStickyBar } from "@/components/stariva/mobile-sticky-bar";
import { Reviews } from "@/components/stariva/reviews";
import { getProductBySlug, getProductsByCategory } from "@/lib/ozon-service";
import { getCategoryBySlug } from "@/lib/products";
import { ProductDetails } from "./product-details";

// ─── FAQ per category (mirrors product-details.tsx) ──────────────────────────
type FaqJsonLdEntry = { question: string; answer: string }[];

const categoryFaqJsonLd: Record<string, FaqJsonLdEntry> & {
  interior: FaqJsonLdEntry;
} = {
  interior: [
    {
      question: "Из чего сделан абажур?",
      answer:
        "Все изделия создаются из натурального хлопкового шнура без синтетических добавок и химических красителей.",
    },
    {
      question: "Как ухаживать за изделием из макраме?",
      answer:
        "Раз в неделю удаляйте пыль мягкой щёткой. При необходимости замочите в тёплой воде с мягким мылом на 15–20 минут, прополощите и сушите горизонтально.",
    },
    {
      question: "Можно ли заказать нестандартный размер?",
      answer:
        "Да, мы принимаем индивидуальные заказы. Напишите в Telegram или позвоните.",
    },
    {
      question: "Как долго ждать заказ?",
      answer:
        "Готовые изделия отправляем в течение 1–3 дней. Изделия на заказ — 7–21 день. Доставка по России через Ozon.",
    },
  ],
  clothes: [
    {
      question: "Как подобрать размер?",
      answer:
        "В описании каждого изделия указаны доступные размеры. Напишите нам в Telegram, поможем подобрать по вашим меркам.",
    },
    {
      question: "Как стирать одежду из макраме?",
      answer:
        "Рекомендуем ручную стирку в прохладной воде с мягким средством. Сушите в расправленном виде горизонтально.",
    },
    {
      question: "Возможен ли индивидуальный заказ?",
      answer:
        "Да, мы создаём изделия по вашим меркам и пожеланиям. Свяжитесь с нами в Telegram или по телефону.",
    },
    {
      question: "Как долго ждать заказ?",
      answer:
        "Готовые изделия отправляем в течение 1–3 дней. Изделия на заказ — 7–21 день. Доставка по России через Ozon.",
    },
  ],
  bags: [
    {
      question: "Насколько прочна сумка из макраме?",
      answer:
        "Хлопковый шнур очень прочный — авоськи выдерживают до 5–7 кг. Изделия рассчитаны на ежедневное использование.",
    },
    {
      question: "Как ухаживать за сумкой?",
      answer:
        "Стирайте вручную в тёплой воде с мягким мылом. Сушите в расправленном виде, избегая прямых солнечных лучей.",
    },
    {
      question: "Можно ли заказать нестандартный размер?",
      answer:
        "Да, принимаем индивидуальные заказы на сумки любого размера и формы. Напишите нам в Telegram.",
    },
    {
      question: "Как быстро доставят заказ?",
      answer:
        "Готовые изделия отправляем в течение 1–3 дней через Ozon. Доставка по всей России.",
    },
  ],
};

export const revalidate = 3600;

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://stariva.ru";

interface ProductPageProps {
  params: Promise<{ category: string; slug: string }>;
}

export async function generateStaticParams() {
  const { getProducts } = await import("@/lib/ozon-service");
  const products = await getProducts();
  return products.map((p) => ({
    category: p.category,
    slug: p.slug,
  }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { category: categorySlug, slug } = await params;
  const product = await getProductBySlug(slug);
  const category = getCategoryBySlug(categorySlug);

  if (!product || !category) return {};

  const title = `${product.name} — купить в интернет-магазине`;
  const description = product.shortDescription
    ? `${product.shortDescription} Ручная работа из натурального хлопка. Купить на Ozon.`
    : `${product.name} — изделие ручного макраме из натурального хлопка. Купить на Ozon.`;
  const url = `/catalog/${categorySlug}/${slug}`;
  const image = product.images[0] ?? "/images/about/hero-founder.jpg";
  const isExternal = image.startsWith("http");

  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}${url}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${BASE_URL}${url}`,
      images: [
        {
          url: isExternal ? image : `${BASE_URL}${image}`,
          width: 800,
          height: 1000,
          alt: product.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [isExternal ? image : `${BASE_URL}${image}`],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { category: categorySlug, slug } = await params;
  const product = await getProductBySlug(slug);
  const category = getCategoryBySlug(categorySlug);

  if (!product || !category || product.category !== categorySlug) {
    notFound();
  }

  const allCategoryProducts = await getProductsByCategory(categorySlug);
  const relatedProducts = allCategoryProducts
    .filter((p) => p.id !== product.id)
    .slice(0, 3);

  const url = `/catalog/${categorySlug}/${slug}`;

  return (
    <>
      <Header variant="solid" />
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Каталог", href: "/catalog" },
          { name: category.name, href: `/catalog/${categorySlug}` },
          { name: product.name, href: url },
        ]}
      />
      <ProductJsonLd
        name={product.name}
        description={product.shortDescription || product.description}
        image={product.images.map((img) =>
          img.startsWith("http") ? img : `${BASE_URL}${img}`,
        )}
        price={product.price}
        oldPrice={product.oldPrice}
        currency={product.currency}
        inStock={product.inStock}
        url={url}
        category={category.name}
        material={product.material}
      />
      <FAQJsonLd
        items={categoryFaqJsonLd[categorySlug] ?? categoryFaqJsonLd.interior}
      />
      <ProductDetails
        product={product}
        category={category}
        categorySlug={categorySlug}
        relatedProducts={relatedProducts}
      />
      <Reviews
        limit={3}
        skus={product.ozonId ? [product.ozonId] : undefined}
        heading="Отзывы о товаре"
      />
      <Footer />
      {product.ozonUrl && (
        <MobileStickyBar ozonUrl={product.ozonUrl} productName={product.name} />
      )}
    </>
  );
}
