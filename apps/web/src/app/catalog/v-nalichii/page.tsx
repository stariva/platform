import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { BreadcrumbJsonLd, ItemListJsonLd } from "@/components/stariva/json-ld";
import { Button } from "@/components/ui/button";
import { IN_STOCK_HREF, IN_STOCK_SHIP_DAYS, pluralItems } from "@/lib/in-stock";
import { MADE_TO_ORDER_DAYS } from "@/lib/made-to-order";
import { categories, getInStockProductsResult } from "@/lib/ozon-service";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import CategoryFilters from "../[category]/category-filters";

// Остатки приходят из Ozon в рантайме (в билд-образе нет креденшелов),
// поэтому, как и остальной каталог, рендерим на каждый запрос.
export const dynamic = "force-dynamic";

const title = "Макраме в наличии — готовые изделия с быстрой отправкой";
const description = `Готовые изделия из макраме ручной работы: одежда, сумки и декор интерьера. Всё уже сплетено — оформите заказ на сайте, отправим за ${IN_STOCK_SHIP_DAYS}.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${BASE_URL}${IN_STOCK_HREF}` },
  openGraph: {
    type: "website",
    title,
    description,
    url: `${BASE_URL}${IN_STOCK_HREF}`,
    images: [
      {
        url: `https://cdn.stariva.ru/site/images/catalog/category-interior.jpg`,
        width: 1200,
        height: 800,
        alt: "Изделия Stariva в наличии",
      },
    ],
  },
};

/**
 * Показывает доступные к покупке изделия с фильтрами по непустым категориям.
 * При пустом списке предлагает перейти в каталог изделий под заказ.
 */
export default async function InStockPage() {
  const { products, status } = await getInStockProductsResult();
  // В таблетках — только категории, где сейчас что-то есть
  const filters = categories.filter((cat) =>
    products.some((p) => p.category === cat.slug),
  );

  return (
    <>
      <Header variant="solid" />
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Каталог", href: "/catalog" },
          { name: "В наличии", href: IN_STOCK_HREF },
        ]}
      />
      <ItemListJsonLd
        name="Изделия из макраме в наличии — Stariva"
        url={IN_STOCK_HREF}
        items={products.map((p) => ({
          name: p.name,
          url: `/catalog/${p.category}/${p.slug}`,
          image: p.images[0]?.startsWith("http")
            ? p.images[0]
            : `${BASE_URL}${p.images[0]}`,
        }))}
      />
      <main className="min-h-screen bg-parchment pt-[60px] lg:pt-[68px]">
        {/* ── Hero ── */}
        <section className="border-b border-espresso/8">
          <div className="max-w-[1440px] mx-auto px-5 lg:px-12 pt-10 pb-10 lg:pt-14 lg:pb-14">
            <nav
              className="flex items-center gap-2 text-sm text-taupe mb-8"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-espresso transition-colors">
                Главная
              </Link>
              <span>/</span>
              <Link
                href="/catalog"
                className="hover:text-espresso transition-colors"
              >
                Каталог
              </Link>
              <span>/</span>
              <span className="text-espresso">В наличии</span>
            </nav>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                {products.length > 0 && (
                  <span className="label-caps text-sage mb-3 block">
                    {products.length} {pluralItems(products.length)} в наличии
                  </span>
                )}
                <h1 className="font-serif text-5xl lg:text-7xl text-espresso leading-[1.0] tracking-tight">
                  Готово к отправке
                </h1>
                <p className="text-taupe mt-4 max-w-xl text-base leading-relaxed">
                  Эти изделия уже сплетены и ждут на складе. Оформите заказ
                  прямо на сайте — отправим за {IN_STOCK_SHIP_DAYS}.
                </p>
              </div>
              <ul className="flex flex-wrap gap-2">
                {[
                  `Отправка за ${IN_STOCK_SHIP_DAYS}`,
                  "Оплата на сайте",
                  "Доставка Ozon по России",
                ].map((item) => (
                  <li
                    key={item}
                    className="px-4 py-2 rounded-full bg-sand text-espresso label-caps text-[11px]"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {products.length > 0 ? (
          <CategoryFilters
            products={products}
            filters={filters}
            filterBy="category"
            showAddToCart
          />
        ) : (
          <section className="py-24 px-5 lg:px-12">
            <div className="max-w-xl mx-auto text-center">
              <p className="font-serif text-3xl text-espresso">
                {status === "available"
                  ? "Сейчас всё разобрали"
                  : "Каталог временно недоступен"}
              </p>
              <p className="text-taupe mt-3 leading-relaxed">
                {status === "available" ? (
                  <>
                    Готовых изделий пока нет, но любую модель из каталога
                    сплетём под вас за {MADE_TO_ORDER_DAYS} — в нужном размере и
                    цвете.
                  </>
                ) : (
                  "Не удалось загрузить изделия в наличии. Попробуйте обновить страницу чуть позже."
                )}
              </p>
              <Button
                asChild
                className="mt-8 rounded-full bg-espresso hover:bg-terracotta text-parchment label-caps h-auto px-6 py-3"
              >
                <Link href="/catalog">Смотреть каталог</Link>
              </Button>
            </div>
          </section>
        )}

        {/* ── Made to order hint ── */}
        {products.length > 0 && (
          <section className="pb-24 px-5 lg:px-12">
            <div className="max-w-[1440px] mx-auto">
              <div className="rounded-2xl bg-sand p-6 lg:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl text-espresso">
                    Не нашли нужное?
                  </h2>
                  <p className="text-taupe text-sm mt-1 leading-relaxed">
                    Любую модель из каталога сплетём под заказ за{" "}
                    {MADE_TO_ORDER_DAYS} — в вашем размере и цвете.
                  </p>
                </div>
                <Button
                  asChild
                  className="rounded-full bg-espresso hover:bg-terracotta text-parchment label-caps h-auto px-6 py-3 self-start md:self-auto"
                >
                  <Link href="/catalog">Весь каталог</Link>
                </Button>
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
