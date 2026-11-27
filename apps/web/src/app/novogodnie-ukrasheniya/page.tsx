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
  groupNewYearProducts,
  NEW_YEAR_PATH,
  newYearProductImage,
  ornamentDetailForSlug,
  toNewYearConfiguratorProduct,
} from "@/lib/new-year";
import { formatPrice } from "@/lib/products";
import { SITE_URL } from "@/lib/site-url";
import newYearHero from "../../../public/images/new-year/hero-russkaya-skazka-v2.webp";
import { NewYearConfigurator } from "./_components/new-year-configurator";

export const dynamic = "force-dynamic";

const NEW_YEAR_EXAMPLES = [
  {
    src: "/images/new-year/examples-tree.webp",
    alt: "Красно-молочные новогодние фигурки с народными узорами на ёлке",
  },
  {
    src: "/images/new-year/examples-hands.webp",
    alt: "Новогодняя фигурка в руке на фоне ёлки и гирлянды",
  },
  {
    src: "/images/new-year/examples-table.webp",
    alt: "Новогодние фигурки на деревянном столе среди еловых ветвей",
  },
  {
    src: "/images/new-year/examples-closeup.webp",
    alt: "Петушок и резной наличник крупным планом на деревянной поверхности",
  },
  {
    src: "/images/new-year/examples-cozy.webp",
    alt: "Новогодние украшения на столе рядом со свечой, книгой и чашкой какао",
  },
] as const;

export const metadata: Metadata = {
  title: "Новогодние наборы украшений — коллекция «Русская сказка»",
  description:
    "Готовые наборы ёлочных украшений с народными орнаментами: выберите состав Stariva, добавьте праздничную коробку или соберите свою подборку фигурок.",
  alternates: { canonical: `${SITE_URL}${NEW_YEAR_PATH}` },
  openGraph: {
    title: "Русская сказка — новогодние наборы украшений Stariva",
    description:
      "Готовые наборы маленьких историй для вашей ёлки. Украшения с народными орнаментами и праздничная упаковка.",
    url: `${SITE_URL}${NEW_YEAR_PATH}`,
    images: [
      {
        url: newYearHero.src,
        width: newYearHero.width,
        height: newYearHero.height,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Новогодние наборы «Русская сказка» — Stariva",
    images: [newYearHero.src],
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
  const groups = groupNewYearProducts(result.products);
  const unavailable = result.status === "unavailable";

  return (
    <>
      <NewYearConfigurator
        ornaments={groups.ornaments.map(toNewYearConfiguratorProduct)}
        sets={groups.sets.map(toNewYearConfiguratorProduct)}
        boxes={groups.boxes.map(toNewYearConfiguratorProduct)}
        catalogUnavailable={unavailable}
      />
      <section
        id="ornaments"
        className="ny-section scroll-mt-24"
        aria-labelledby="ornaments-title"
      >
        <p className="ny-eyebrow">Если хочется особый состав</p>
        <h2 id="ornaments-title" className="ny-heading">
          Фигурки по отдельности
        </h2>
        {groups.ornaments.length > 0 ? (
          <>
            <p className="mt-5 max-w-2xl text-taupe">
              Сначала посмотрите готовые наборы выше — они уже собраны для ёлки
              и подарка. Если нужен свой состав, добавьте фигурки по одной или
              вернитесь к конфигуратору.
            </p>
            <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {groups.ornaments.map((product, index) => (
                <article
                  key={product.slug}
                  id={product.slug}
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
                      src={newYearProductImage(product)}
                      alt={`Новогоднее украшение «${product.name}»`}
                      width={240}
                      height={260}
                      className="h-52 w-full object-contain p-4 transition-transform duration-300 motion-safe:hover:scale-105 sm:h-60"
                    />
                  </div>
                  <h3 className="mt-5 font-serif text-2xl">{product.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-taupe">
                    {product.shortDescription ||
                      ornamentDetailForSlug(product.slug) ||
                      "Новогоднее украшение из коллекции «Русская сказка»."}
                  </p>
                  <Purchase
                    product={product}
                    name={product.name}
                    unavailable={unavailable}
                  />
                </article>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="mt-5 text-taupe">
              {unavailable
                ? "Не удалось загрузить фигурки коллекции."
                : "Фигурки пока не опубликованы в каталоге."}
            </p>
            <ContactMasterButton
              source="new-year-collection"
              withPageLink
              message="Здравствуйте! Подскажите, как заказать новогодние украшения из коллекции «Русская сказка»."
              className="mt-5 min-h-11 rounded-md border border-espresso/25 px-4 py-3 text-sm transition-colors hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              Уточнить заказ
            </ContactMasterButton>
          </>
        )}
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
      <main className="ny-page bg-parchment pt-15 text-espresso lg:pt-17">
        <section className="ny-hero" aria-labelledby="new-year-title">
          <div className="ny-hero-copy">
            <nav
              aria-label="Хлебные крошки"
              className="mb-5 flex flex-wrap items-center gap-2 text-xs text-taupe"
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
            <p className="ny-eyebrow">Stariva · Новогодние наборы</p>
            <h1 id="new-year-title" className="ny-hero-title">
              Русская
              <br />
              <span>сказка</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-taupe xl:text-lg">
              Готовые наборы ёлочных украшений с народными орнаментами. Выберите
              состав, добавьте праздничную коробку — и тёплый подарок собран.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="min-h-12 px-4 sm:px-6">
                <a href="#configurator">Выбрать набор</a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="min-h-12 px-4 sm:px-6"
              >
                <a href="#ornaments">Фигурки по отдельности</a>
              </Button>
            </div>
            <p className="mt-6 text-xs tracking-wide text-taupe">
              Созданы на 3D-принтере · вдохновлены народными орнаментами
            </p>
          </div>
          <figure className="ny-hero-art">
            <Image
              src={newYearHero}
              alt="Шар, резной наличник, балалайка, петушок и бублик с красно-молочными узорами на еловых ветвях в тёплом свете гирлянды"
              placeholder="blur"
              sizes="(min-width: 1600px) 880px, (min-width: 1024px) 55vw, calc(100vw - 48px)"
              className="block h-auto w-full"
            />
            <figcaption className="sr-only">
              Цветочный шар, резной наличник, балалайка, петушок и бублик.
            </figcaption>
          </figure>
        </section>
        <div className="ny-ribbon">
          <span>Готовые сочетания</span>
          <span aria-hidden="true">✳</span>
          <span>Состав виден сразу</span>
          <span aria-hidden="true">✳</span>
          <span>Праздничная коробка по желанию</span>
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
        <section
          id="examples"
          className="ny-section"
          aria-labelledby="examples-title"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="ny-eyebrow">Примеры работ</p>
              <h2 id="examples-title" className="ny-heading">
                Так фигурки выглядят дома
              </h2>
            </div>
            <p className="max-w-md leading-relaxed text-taupe">
              Фотографии показывают цвет, фактуру печати и масштаб украшений в
              интерьере. Актуальный состав коллекции — в каталоге выше.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-12">
            {NEW_YEAR_EXAMPLES.map((example, index) => (
              <figure
                key={example.src}
                className={
                  index === 0
                    ? "group relative aspect-4/3 overflow-hidden rounded-3xl bg-sand md:col-span-7"
                    : index === 1
                      ? "group relative aspect-4/3 overflow-hidden rounded-3xl bg-sand md:col-span-5"
                      : "group relative aspect-4/3 overflow-hidden rounded-3xl bg-sand md:col-span-4"
                }
              >
                <Image
                  src={example.src}
                  alt={example.alt}
                  fill
                  sizes={
                    index === 0
                      ? "(max-width: 768px) 100vw, 58vw"
                      : index === 1
                        ? "(max-width: 768px) 100vw, 42vw"
                        : "(max-width: 768px) 100vw, 33vw"
                  }
                  className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
                />
              </figure>
            ))}
          </div>
        </section>
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
                Цветочный шар, нарядный петушок, балалайка и резной наличник. Мы
                собрали знакомые образы в коллекцию подвесных украшений с
                растительными орнаментами.
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
                "Выберите набор",
                "Начните с готового сочетания или соберите свою коробку фигурок. Праздничная упаковка добавляется отдельным товаром.",
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
