import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BuyingGuide } from "@/components/stariva/buying-guide";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import {
  BreadcrumbJsonLd,
  FAQJsonLd,
  ProductJsonLd,
} from "@/components/stariva/json-ld";
import { MobileStickyBar } from "@/components/stariva/mobile-sticky-bar";
import { ProductAnalytics } from "@/components/stariva/product-analytics";
import { Reviews } from "@/components/stariva/reviews";
import {
  productMetaDescription,
  productMetaTitle,
} from "@/lib/catalog/product-seo";
import {
  getProductBySlug,
  getProductsByCategory,
  getReviews,
  summarizeRatings,
} from "@/lib/ozon-service";
import { getCategoryBySlug } from "@/lib/products";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
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
      question: "Как ухаживать за изделием в технике макраме?",
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
        "Готовые изделия отправляем в течение 1–3 дней. Изделия на заказ — 2–4 дня. Доставка по России через Ozon.",
    },
  ],
  clothes: [
    {
      question: "Как подобрать размер?",
      answer:
        "Каждую вещь плетём под заказ: выберите стандартный размер или отправьте свои мерки — рост, обхват груди, талии и бёдер. Мастер проверит мерки и согласует детали до начала работы.",
    },
    {
      question: "Как стирать одежду, сплетённую в технике макраме?",
      answer:
        "Рекомендуем ручную стирку в прохладной воде с мягким средством. Сушите в расправленном виде горизонтально.",
    },
    {
      question: "Можно ли выбрать другой цвет?",
      answer:
        "Да. Любую модель сплетём в другом цвете шнура, точный оттенок согласуем перед плетением. Изготовление занимает 2–4 дня.",
    },
    {
      question: "Как долго ждать заказ?",
      answer:
        "Готовые изделия отправляем в течение 1–3 дней. Изделия на заказ — 2–4 дня. Доставка по России через Ozon.",
    },
  ],
  bags: [
    {
      question: "Насколько прочна сумка в технике макраме?",
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

  if (!product || !category || product.category !== categorySlug) return {};

  const title = productMetaTitle(product);
  const description = productMetaDescription(product);
  const url = `/catalog/${categorySlug}/${slug}`;
  const image =
    product.images[0] ??
    "https://cdn.stariva.ru/site/images/about/founder-2026.jpg";
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

/** Renders a product with its rating, reviews, and related products. */
export default async function ProductPage({ params }: ProductPageProps) {
  const { category: categorySlug, slug } = await params;
  const product = await getProductBySlug(slug);
  const category = getCategoryBySlug(categorySlug);

  if (!product || !category || product.category !== categorySlug) {
    notFound();
  }

  const allCategoryProducts = await getProductsByCategory(categorySlug);
  // Сначала похожие из той же подкатегории, затем остальные из категории
  const relatedProducts = allCategoryProducts
    .filter((p) => p.id !== product.id)
    .sort(
      (a, b) =>
        Number(b.subcategory === product.subcategory) -
        Number(a.subcategory === product.subcategory),
    )
    .slice(0, 3);

  const url = `/catalog/${categorySlug}/${slug}`;

  const productReviews = await getReviews({ productId: product.id });
  const rating = summarizeRatings(productReviews);
  // Google не разрешает размечать отзывы, собранные на других площадках, —
  // отзывы с Авито показываем, но в разметку товара не отдаём
  const markupReviews = productReviews.filter((r) => r.source !== "avito");

  return (
    <>
      <ProductAnalytics
        product={{
          id: product.slug,
          name: product.name,
          price: product.price,
          category: product.category,
        }}
      />
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
        description={productMetaDescription(product)}
        image={product.images.map((img) =>
          img.startsWith("http") ? img : `${BASE_URL}${img}`,
        )}
        price={product.price}
        oldPrice={product.oldPrice}
        currency={product.currency}
        inStock={product.inStock}
        madeToOrder={product.madeToOrder}
        url={url}
        category={category.name}
        material={product.material}
        color={product.color}
        rating={summarizeRatings(markupReviews)}
        reviews={markupReviews}
      />
      <FAQJsonLd
        items={categoryFaqJsonLd[categorySlug] ?? categoryFaqJsonLd.interior}
      />
      <ProductDetails
        product={product}
        category={category}
        categorySlug={categorySlug}
        relatedProducts={relatedProducts}
        rating={rating}
      />
      <BuyingGuide product={product} />
      <Reviews productId={product.id} heading="Отзывы о товаре" />
      <Footer />
      <MobileStickyBar />
    </>
  );
}
