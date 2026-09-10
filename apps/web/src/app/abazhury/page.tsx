import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { BreadcrumbJsonLd, ItemListJsonLd } from "@/components/stariva/json-ld";
import { getProductsByCategory } from "@/lib/ozon-service";
import { categories } from "@/lib/products";
import { SITE_URL } from "@/lib/site-url";
import CategoryFilters from "../catalog/[category]/category-filters";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Абажуры макраме ручной работы — выбрать и купить",
  description:
    "Абажуры Stariva: фотографии, размеры и цены. Выберите модель для дома или кафе, уточните комплектацию и оформите заказ на сайте.",
  alternates: { canonical: `${SITE_URL}/abazhury` },
  openGraph: {
    title: "Абажуры макраме Stariva",
    url: `${SITE_URL}/abazhury`,
    description:
      "Ручное плетение для вашего интерьера. Модели, размеры и цены в каталоге.",
  },
};

export default async function LampshadesPage() {
  const products = (await getProductsByCategory("interior")).filter(
    (p) => p.subcategory === "lampshades",
  );
  const interior = categories.find((c) => c.slug === "interior");
  if (!interior) throw new Error("Interior category is required");
  return (
    <>
      <Header variant="solid" />
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Абажуры", href: "/abazhury" },
        ]}
      />
      <ItemListJsonLd
        name="Абажуры макраме"
        url="/abazhury"
        items={products.map((p) => ({
          name: p.name,
          url: `/catalog/interior/${p.slug}`,
          image: p.images[0],
        }))}
      />
      <main className="bg-parchment text-espresso pt-32">
        <section className="max-w-5xl mx-auto px-5 lg:px-12 pb-10">
          <Link
            href="/catalog/interior"
            className="text-sm text-taupe underline"
          >
            Весь декор интерьера
          </Link>
          <h1 className="font-serif text-5xl lg:text-7xl mt-6 mb-6">
            Абажуры макраме
          </h1>
          <p className="text-lg max-w-2xl leading-relaxed">
            Плетёные абажуры ручной работы для дома и кафе. Сравните фотографии,
            размеры и цены, чтобы выбрать модель для своего пространства.
          </p>
        </section>
        <CategoryFilters
          products={products}
          category={{ ...interior, name: "Абажуры", subcategories: [] }}
          categorySlug="interior"
        />
        <section className="max-w-5xl mx-auto px-5 lg:px-12 pb-20 space-y-8">
          <h2 className="font-serif text-3xl">Что проверить перед заказом</h2>
          <div className="grid md:grid-cols-3 gap-8 leading-relaxed">
            <div>
              <h3 className="font-medium mb-2">Размер и место</h3>
              <p>
                Сопоставьте диаметр и высоту из карточки с местом над столом или
                в комнате. Высоту подвеса измеряйте отдельно: она зависит от
                вашего светильника.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Комплектация</h3>
              <p>
                Абажур и светильник — разные изделия. Если в названии указано
                «без патрона и провода», электрическая часть не входит в
                комплект. До покупки уточните совместимость крепления.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Материал и уход</h3>
              <p>
                Материал указан для каждой модели. Уточните уход и допустимые
                условия использования; не устанавливайте изделие вплотную к
                источнику нагрева.
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-sand p-6 space-y-3">
            <h2 className="font-serif text-3xl">Нужна помощь с выбором?</h2>
            <p>
              Подготовьте размеры места и фото интерьера. Обсудить модель и
              индивидуальный размер можно с мастерской; срок и стоимость
              согласуем до заказа.
            </p>
            <Link
              href="/#order"
              className="inline-block underline text-terracotta"
            >
              Обсудить индивидуальный заказ
            </Link>
          </div>
          <p>
            Заказ оформляется на сайте. Стоимость и доступные варианты доставки
            проверяются при оформлении до перехода к оплате.{" "}
            <Link href="/offer" className="underline">
              Условия заказа и возврата
            </Link>
            .
          </p>
          <p>
            Для оформления кафе и ресторанов посмотрите{" "}
            <Link href="/b2b" className="underline">
              изделия для бизнеса
            </Link>
            .
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
