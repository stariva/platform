import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { BreadcrumbJsonLd, ItemListJsonLd } from "@/components/stariva/json-ld";
import { categories, getProductsByCategory } from "@/lib/ozon-service";
import { getCategoryBySlug } from "@/lib/products";
import CategoryFilters from "./category-filters";

export const revalidate = 3600;

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://stariva.ru";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  return categories.map((cat) => ({ category: cat.slug }));
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = getCategoryBySlug(categorySlug);
  if (!category) return {};

  const title = `${category.name} из макраме — купить ручной работы`;
  const description = `${category.description} Ручная работа из натурального хлопка. Купить на Ozon с доставкой по России.`;
  const url = `/catalog/${categorySlug}`;

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
          url: `${BASE_URL}${category.image}`,
          width: 1200,
          height: 800,
          alt: category.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${BASE_URL}${category.image}`],
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params;
  const category = getCategoryBySlug(categorySlug);

  if (!category) {
    notFound();
  }

  const products = await getProductsByCategory(categorySlug);

  return (
    <>
      <Header variant="solid" />
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Каталог", href: "/catalog" },
          { name: category.name, href: `/catalog/${categorySlug}` },
        ]}
      />
      <ItemListJsonLd
        name={`${category.name} из макраме — Stariva`}
        url={`/catalog/${categorySlug}`}
        items={products.map((p) => ({
          name: p.name,
          url: `/catalog/${categorySlug}/${p.slug}`,
          image: p.images[0]?.startsWith("http")
            ? p.images[0]
            : `${BASE_URL}${p.images[0]}`,
        }))}
      />
      <main className="min-h-screen bg-parchment">
        {/* ── Category Hero ── */}
        <section className="relative overflow-hidden bg-espresso">
          <div className="absolute inset-0">
            <Image
              src={category.image}
              alt={category.name}
              fill
              className="object-cover opacity-40"
              priority
              sizes="100vw"
            />
          </div>
          <div className="relative z-10 max-w-[1440px] mx-auto px-5 lg:px-12 pt-32 pb-16 lg:pt-40 lg:pb-20">
            {/* Breadcrumb */}
            <nav
              className="flex items-center gap-2 text-sm text-white/50 mb-8"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-white/80 transition-colors">
                Главная
              </Link>
              <span>/</span>
              <Link
                href="/catalog"
                className="hover:text-white/80 transition-colors"
              >
                Каталог
              </Link>
              <span>/</span>
              <span className="text-white/80">{category.name}</span>
            </nav>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <span className="label-caps text-linen/70 mb-3 block">
                  {products.length} товаров
                </span>
                <h1 className="font-serif text-5xl lg:text-7xl text-white leading-[1.0] tracking-tight">
                  {category.name}
                </h1>
                <p className="text-white/60 mt-4 max-w-md text-base leading-relaxed">
                  {category.description}
                </p>
              </div>
              {/* Sub-category quick links */}
              <div className="flex flex-wrap gap-2">
                {category.subcategories.map((sub) => (
                  <span
                    key={sub.slug}
                    className="px-4 py-2 rounded-full border border-white/20 text-white/60 label-caps text-[11px]"
                  >
                    {sub.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Products with Filters ── */}
        <CategoryFilters
          products={products}
          category={category}
          categorySlug={categorySlug}
        />

        {/* ── Other Categories ── */}
        <section className="pb-24 px-5 lg:px-12">
          <div className="max-w-[1440px] mx-auto">
            <h2 className="font-serif text-2xl lg:text-3xl text-espresso mb-8">
              Другие направления
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4">
              {categories
                .filter((c) => c.slug !== categorySlug)
                .map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/catalog/${cat.slug}`}
                    className="group relative overflow-hidden rounded-xl bg-sand hover:bg-espresso transition-colors duration-300"
                  >
                    <div className="flex items-center gap-5 p-5">
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                        <Image
                          src={cat.image}
                          alt={cat.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="80px"
                        />
                      </div>
                      <div>
                        <h3 className="font-serif text-xl text-espresso group-hover:text-parchment transition-colors">
                          {cat.name}
                        </h3>
                        <p className="text-taupe group-hover:text-parchment/60 text-sm line-clamp-1 transition-colors mt-0.5">
                          {cat.description}
                        </p>
                      </div>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                        className="ml-auto flex-shrink-0 text-espresso/20 group-hover:text-parchment/40 transition-colors"
                      >
                        <path
                          d="M3 8h10M9 4l4 4-4 4"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </section>

        {/* ── SEO Text ── */}
        <CategorySeoText categorySlug={categorySlug} />
      </main>
      <Footer />
    </>
  );
}

// ─── Per-category SEO text blocks ────────────────────────────────────────────

const seoTexts: Record<string, { heading: string; body: string }> = {
  interior: {
    heading: "Абажуры и декор из макраме ручной работы",
    body: "Каждый абажур Stariva — это уникальное изделие, созданное вручную из натурального хлопкового шнура. Мы не используем синтетику и химические красители: только экологичные материалы, которые безопасны для вашего дома. Абажур из макраме создаёт мягкий рассеянный свет и уютную игру теней, превращая любую комнату в тёплое пространство. Панно, плейсменты и вигвамы дополнят интерьер в стиле бохо, скандинавском или эко-стиле. Все изделия доступны для покупки на Ozon с доставкой по всей России.",
  },
  clothes: {
    heading: "Одежда из макраме ручной работы",
    body: "Платья, топы и накидки Stariva создаются вручную из мягкого хлопкового шнура. Каждое изделие — это авторская работа, которая не имеет точных копий. Одежда из макраме идеально подходит для пляжного отдыха, фотосессий и повседневного образа в стиле бохо. Натуральный хлопок приятен к телу, дышит и не вызывает аллергии. Возможен индивидуальный заказ по вашим меркам. Купить на Ozon с доставкой по всей России.",
  },
  bags: {
    heading: "Сумки и авоськи из макраме ручной работы",
    body: "Авторские сумки, авоськи и корзины Stariva сплетены вручную из прочного хлопкового шнура. Каждое изделие сочетает практичность и эстетику: вместительные шопперы для покупок, изящные клатчи для вечернего образа, плетёные корзины для хранения. Натуральный хлопок прочен и долговечен — такая сумка прослужит годами. Все изделия доступны на Ozon с доставкой по всей России.",
  },
};

function CategorySeoText({ categorySlug }: { categorySlug: string }) {
  const text = seoTexts[categorySlug];
  if (!text) return null;

  return (
    <section className="pb-20 px-5 lg:px-12">
      <div className="max-w-[1440px] mx-auto">
        <div className="max-w-3xl border-t border-espresso/8 pt-12">
          <h2 className="font-serif text-2xl lg:text-3xl text-espresso mb-5">
            {text.heading}
          </h2>
          <p className="text-taupe text-base leading-[1.9]">{text.body}</p>
        </div>
      </div>
    </section>
  );
}
