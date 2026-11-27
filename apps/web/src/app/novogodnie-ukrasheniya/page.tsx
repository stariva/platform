import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AddToCartButton } from "@/components/stariva/add-to-cart-button";
import { ContactMasterButton } from "@/components/stariva/contact-master";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { BreadcrumbJsonLd } from "@/components/stariva/json-ld";
import { Button } from "@/components/ui/button";
import { getProductsResult } from "@/lib/catalog/service";
import type { Product } from "@/lib/catalog/types";
import { isCatalogProductBuyable } from "@/lib/commerce/catalog";
import {
  NEW_YEAR_IMAGE,
  NEW_YEAR_PATH,
  ornamentImage,
  ornamentSets,
  ornamentSlug,
  ornaments,
} from "@/lib/new-year";
import { formatPrice } from "@/lib/products";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Новогодние украшения — коллекция «Русская сказка»",
  description:
    "Ёлочные украшения с народными орнаментами: домик, самовар, снежинка и другие фигурки. Выберите набор или отдельные украшения Stariva.",
  alternates: { canonical: `${SITE_URL}${NEW_YEAR_PATH}` },
  openGraph: {
    title: "Русская сказка — новогодние украшения Stariva",
    description:
      "Маленькие истории для вашей ёлки. Коллекция украшений с народными орнаментами.",
    url: `${SITE_URL}${NEW_YEAR_PATH}`,
    images: [{ url: NEW_YEAR_IMAGE, width: 1280, height: 853 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Русская сказка — Stariva",
    images: [NEW_YEAR_IMAGE],
  },
};

function Purchase({
  product,
  name,
  unavailable,
}: {
  product?: Product;
  name: string;
  unavailable: boolean;
}) {
  const buyable = isCatalogProductBuyable(product);
  return (
    <div className="mt-auto flex flex-col gap-3 pt-5">
      {product && (
        <>
          <p className="text-xl font-medium">
            {formatPrice(product.price, product.currency)}
          </p>
          <dl className="flex flex-col gap-1 text-sm text-taupe">
            {product.material && (
              <div>
                <dt className="inline">Материал: </dt>
                <dd className="inline">{product.material}</dd>
              </div>
            )}
            {product.dimensions && (
              <div>
                <dt className="inline">Размер: </dt>
                <dd className="inline">{product.dimensions}</dd>
              </div>
            )}
            {product.color && (
              <div>
                <dt className="inline">Цвет: </dt>
                <dd className="inline">{product.color}</dd>
              </div>
            )}
          </dl>
        </>
      )}
      {buyable && product ? (
        <>
          <p className="text-sm text-taupe">В наличии · доставка Ozon</p>
          <AddToCartButton product={product} />
        </>
      ) : (
        <>
          <p className="text-sm text-taupe">
            {unavailable
              ? "Не удалось проверить цену и наличие"
              : product
                ? "Сейчас нет в продаже"
                : "Готовим к продаже"}
          </p>
          <ContactMasterButton
            source="new-year-collection"
            withPageLink
            message={`Здравствуйте! Интересуют новогодние украшения «${name}». Подскажите цену, размеры, комплектацию и срок отправки.`}
            className="min-h-11 rounded-md border border-espresso/25 px-4 py-3 text-sm transition-colors hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            Уточнить заказ
          </ContactMasterButton>
        </>
      )}
    </div>
  );
}

async function Collection() {
  const result = await getProductsResult();
  const bySlug = new Map(
    result.products.map((product) => [product.slug, product]),
  );
  const unavailable = result.status === "unavailable";
  return (
    <>
      <section
        id="sets"
        className="ny-section scroll-mt-24"
        aria-labelledby="sets-title"
      >
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="ny-eyebrow">Вместе красивее</p>
            <h2 id="sets-title" className="ny-heading">
              Праздник в наборе
            </h2>
          </div>
          <p className="max-w-sm text-taupe">
            Два сочетания для вашей ёлки.
            <br />
            Выберите настроение — мы собрали детали.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {ornamentSets.map((set) => (
            <article
              key={set.slug}
              id={set.slug}
              className="flex scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-espresso/10"
            >
              <div
                className="ny-set-art"
                role="group"
                aria-label={`Состав набора ${set.name}`}
              >
                {set.ids.map((id) => (
                  <Image
                    key={id}
                    src={ornamentImage(id)}
                    alt={ornaments.find((item) => item.id === id)?.name ?? id}
                    width={100}
                    height={125}
                    className="h-24 w-full object-contain sm:h-32"
                  />
                ))}
              </div>
              <div className="flex flex-1 flex-col p-6 lg:p-8">
                <p className="ny-eyebrow">{set.ids.length} украшений</p>
                <h3 className="font-serif text-3xl">{set.name}</h3>
                <p className="mt-3 text-taupe">{set.description}</p>
                <p className="mt-4 text-sm leading-relaxed text-taupe">
                  {set.ids
                    .map((id) => ornaments.find((item) => item.id === id)?.name)
                    .join(" · ")}
                </p>
                <Purchase
                  product={bySlug.get(set.slug)}
                  name={set.name}
                  unavailable={unavailable}
                />
              </div>
            </article>
          ))}
        </div>
      </section>
      <section
        id="ornaments"
        className="ny-section scroll-mt-24"
        aria-labelledby="ornaments-title"
      >
        <p className="ny-eyebrow">Каждая — со своим характером</p>
        <h2 id="ornaments-title" className="ny-heading">
          Девять маленьких историй
        </h2>
        <p className="mt-5 max-w-2xl text-taupe">
          Выберите любимую фигурку или дополните набор. Здесь показаны эскизы
          моделей: фактура и оттенок напечатанного изделия могут отличаться.
        </p>
        <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {ornaments.map((item, index) => (
            <article
              key={item.id}
              id={ornamentSlug(item.id)}
              className="flex scroll-mt-24 flex-col"
            >
              <div className="ny-ornament-art">
                <span
                  className="absolute left-5 top-4 text-xs text-taupe"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Image
                  src={ornamentImage(item.id)}
                  alt={`Эскиз украшения «${item.name}»`}
                  width={240}
                  height={260}
                  className="h-52 w-full object-contain p-4 transition-transform duration-300 motion-safe:hover:scale-105 sm:h-60"
                />
              </div>
              <h3 className="mt-5 font-serif text-2xl">{item.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-taupe">
                {item.detail}
              </p>
              <Purchase
                product={bySlug.get(ornamentSlug(item.id))}
                name={item.name}
                unavailable={unavailable}
              />
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export default function NewYearPage() {
  return (
    <>
      <Header variant="solid" selectedSectionHref={NEW_YEAR_PATH} />
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Каталог", href: "/catalog" },
          { name: "Новогодние украшения", href: NEW_YEAR_PATH },
        ]}
      />
      <main className="ny-page bg-parchment pt-[60px] text-espresso lg:pt-[68px]">
        <section className="ny-hero">
          <div className="flex flex-col items-start justify-center px-6 py-12 lg:px-16 lg:py-20">
            <nav
              aria-label="Хлебные крошки"
              className="mb-10 flex flex-wrap items-center gap-2 text-xs text-taupe"
            >
              <Link
                href="/catalog"
                className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                Каталог
              </Link>
              <span aria-hidden="true">/</span>
              <span>Новогодние украшения</span>
            </nav>
            <p className="ny-eyebrow">Stariva · Новогодняя коллекция</p>
            <h1 className="ny-hero-title">
              Русская
              <br />
              <span>сказка</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-taupe">
              Маленькие истории для вашей ёлки. Народные узоры, знакомые силуэты
              и тепло домашнего праздника.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="min-h-12">
                <a href="#sets">Выбрать набор</a>
              </Button>
              <Button asChild variant="outline" size="lg" className="min-h-12">
                <a href="#ornaments">Все украшения</a>
              </Button>
            </div>
            <p className="mt-6 text-xs tracking-wide text-taupe">
              Созданы на 3D-принтере · вдохновлены народными орнаментами
            </p>
          </div>
          <figure className="relative min-h-80 lg:min-h-[660px]">
            <Image
              src={NEW_YEAR_IMAGE}
              alt="Красно-молочные ёлочные украшения с народными узорами среди еловых ветвей"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
            <figcaption className="absolute bottom-4 left-4 right-4 rounded-lg bg-parchment/95 px-4 py-3 text-xs text-espresso">
              Настроение коллекции. Точный состав каждого набора указан ниже.
            </figcaption>
          </figure>
        </section>
        <div className="ny-ribbon">
          <span>Для своей ёлки</span>
          <span aria-hidden="true">✳</span>
          <span>Для тёплого подарка</span>
          <span aria-hidden="true">✳</span>
          <span>Для семейных традиций</span>
        </div>
        <Suspense
          fallback={
            <div className="ny-section" role="status">
              Загружаем коллекцию и проверяем наличие…
            </div>
          }
        >
          <Collection />
        </Suspense>
        <section className="bg-sand">
          <div className="ny-section grid gap-10 md:grid-cols-2">
            <div>
              <p className="ny-eyebrow">Знакомые узоры. Новая форма.</p>
              <h2 className="ny-heading">
                Из сказки —<br />
                на вашу ёлку
              </h2>
            </div>
            <div className="flex flex-col gap-5 text-taupe leading-relaxed">
              <p>
                Резные наличники, нарядный самовар, пряничный домик. Мы собрали
                знакомые образы в коллекцию подвесных украшений с растительными
                орнаментами.
              </p>
              <p>
                Фигурки напечатаны на 3D-принтере. У этой технологии есть своя
                фактура: на поверхности могут быть заметны тонкие линии слоёв.
              </p>
              <p>
                Материал, размеры, подвесы и упаковку уточняйте для выбранной
                модели перед заказом.
              </p>
            </div>
          </div>
        </section>
        <section
          id="delivery"
          className="ny-section"
          aria-labelledby="delivery-title"
        >
          <p className="ny-eyebrow">От нашей мастерской — к вашему празднику</p>
          <h2 id="delivery-title" className="ny-heading">
            Как получить украшения
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              [
                "Выберите украшения",
                "Готовые товары с ценой и наличием можно добавить в корзину. Если продажи ещё не открыты, напишите нам через «Уточнить заказ».",
              ],
              [
                "Оформите на сайте",
                "Для доступных товаров выберите доставку Ozon. Стоимость и доступные даты проверяются при оформлении до оплаты.",
              ],
              [
                "Заберите и украсьте ёлку",
                "Для получения через Ozon нужен аккаунт Ozon. Перед праздниками ориентируйтесь на дату доставки для вашего адреса.",
              ],
            ].map(([title, text], index) => (
              <li key={title}>
                <p className="ny-eyebrow">0{index + 1}</p>
                <h3 className="font-serif text-2xl">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-taupe">
                  {text}
                </p>
              </li>
            ))}
          </ol>
          <Link
            href="/offer"
            className="mt-8 inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          >
            Условия заказа и возврата
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
