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
  isNewYearProductPurchasable,
  NEW_YEAR_PATH,
  newYearDisplayName,
  newYearProductImage,
  ornamentDetailForSlug,
  toNewYearConfiguratorProduct,
} from "@/lib/new-year";
import { formatPrice } from "@/lib/products";
import { SITE_URL } from "@/lib/site-url";
import newYearHero from "../../../public/images/new-year/hero-russkaya-skazka-v2.webp";
import {
  NewYearConfigurator,
  SelectOrnamentButton,
} from "./_components/new-year-configurator";

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
    alt: "Петух и резной наличник крупным планом на деревянной поверхности",
  },
  {
    src: "/images/new-year/examples-cozy.webp",
    alt: "Новогодние украшения на столе рядом со свечой, книгой и чашкой какао",
  },
] as const;

const NEW_YEAR_PACKAGING = [
  {
    src: "/images/new-year/gift-box-closed.webp",
    alt: "Закрытая красная подарочная коробка с молочным растительным орнаментом и надписью «Зимний уют»",
    title: "Готова к вручению",
    text: "Закрытая коробка выглядит как самостоятельный подарок — дополнительно упаковывать её не нужно.",
  },
  {
    src: "/images/new-year/gift-box-open.webp",
    alt: "Красная выдвижная подарочная коробка, приоткрытая вместе с внутренним ложементом для украшений",
    title: "Выдвижной ящик",
    text: "Крышка сдвигается в сторону и открывает аккуратный ряд ячеек для каждой фигурки.",
  },
  {
    src: "/images/new-year/gift-box-inside.webp",
    alt: "Открытая подарочная коробка с новогодними украшениями внутри индивидуальных ячеек",
    title: "Фигурки на своих местах",
    text: "Внутри украшения разложены по отдельным углублениям, чтобы не соприкасаться в дороге.",
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
  const madeToOrderBuyable = isNewYearProductPurchasable(product);
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
      ) : madeToOrderBuyable && product ? (
        <>
          <p className="text-sm text-taupe">
            Изготовим за 2–4 дня · доставка Ozon
          </p>
          <SelectOrnamentButton slug={product.slug} name={name} />
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
        <p className="ny-eyebrow">Все образы коллекции</p>
        <h2 id="ornaments-title" className="ny-heading">
          Фигурки по отдельности
        </h2>
        {groups.ornaments.length > 0 ? (
          <>
            <p className="mt-5 max-w-2xl text-taupe">
              Рассмотрите каждый сюжет в деталях. Отметьте любые 7 или больше
              фигурок в «Свою коробку» — можно собрать как разные образы, так и
              парные игрушки на ёлку.
            </p>
            <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {groups.ornaments.map((product, index) => {
                const displayName = newYearDisplayName(product);
                return (
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
                        alt={`Новогоднее украшение «${displayName}»`}
                        width={240}
                        height={260}
                        className="h-52 w-full object-contain p-4 transition-transform duration-300 motion-safe:hover:scale-105 sm:h-60"
                      />
                    </div>
                    <h3 className="mt-5 font-serif text-2xl">{displayName}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-taupe">
                      {ornamentDetailForSlug(product.slug) ||
                        product.shortDescription ||
                        "Новогоднее украшение из коллекции «Русская сказка»."}
                    </p>
                    <Purchase
                      product={product}
                      name={displayName}
                      unavailable={unavailable}
                    />
                  </article>
                );
              })}
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
              близкий сердцу состав, добавьте подарочную шкатулку — и тёплый
              семейный подарок собран.
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
              Авторская коллекция Ольги Карпычевой · вдохновлена русской домовой
              резьбой и вышивкой
            </p>
          </div>
          <figure className="ny-hero-art">
            <Image
              src={newYearHero}
              alt="Шар, резной наличник, балалайка, петух и баранка с красно-молочными узорами на еловых ветвях в тёплом свете гирлянды"
              fetchPriority="high"
              placeholder="blur"
              sizes="(min-width: 1600px) 880px, (min-width: 1024px) 55vw, calc(100vw - 48px)"
              className="block h-auto w-full"
            />
            <figcaption className="sr-only">
              Ёлочный шар, резной наличник, балалайка, петух и баранка.
            </figcaption>
          </figure>
        </section>
        <div className="ny-ribbon">
          <span>Высота фигурок 8–10 см</span>
          <span aria-hidden="true">✳</span>
          <span>Лёгкие и небьющиеся · с подвесами</span>
          <span aria-hidden="true">✳</span>
          <span>Изготовим за 2–4 дня · доставка Ozon</span>
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
          id="packaging"
          className="ny-section"
          aria-labelledby="packaging-title"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="ny-eyebrow">Подарочный набор</p>
              <h2 id="packaging-title" className="ny-heading">
                Подарочный футляр-шкатулка
              </h2>
            </div>
            <p className="max-w-md leading-relaxed text-taupe">
              Красный выдвижной футляр с молочным орнаментом и отдельными
              ячейками для 7 фигурок. В нём удобно дарить коллекцию без
              дополнительной упаковки и бережно хранить игрушки из года в год.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {NEW_YEAR_PACKAGING.map((item) => (
              <figure
                key={item.src}
                className="group overflow-hidden rounded-3xl bg-sand"
              >
                <span className="relative block aspect-square overflow-hidden">
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
                  />
                </span>
                <figcaption className="p-5">
                  <h3 className="font-serif text-2xl text-espresso">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-taupe">
                    {item.text}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
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
              Фотографии показывают живой оттенок, рельефную фактуру и масштаб
              украшений на еловых ветвях и в домашнем интерьере.
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
                Ёлочный шар, расписная матрёшка, нарядный петух, балалайка и
                резной наличник. Мы собрали родные с детства образы в коллекцию
                подвесных украшений с тонкими растительными орнаментами.
              </p>
              <p>
                Каждая фигурка создаётся послойно в нашей мастерской из прочного
                эко-биопластика (PLA). Тонкий рельеф слоёв напоминает фактуру
                дерева и бересты, а двухцветный узор вплавлен в саму форму и не
                тускнеет со временем.
              </p>
              <p>
                Украшения лёгкие, не бьются при падении с ветки и безопасны для
                детей и домашних питомцев. Высота фигурок — 8–10 см, подвесы уже
                входят в комплект.
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
                "Выберите набор или свой состав",
                "Начните с готового набора — от камерной семёрки до всей коллекции «Сказочный терем» — или соберите свою коробку. Подарочный футляр с ложементом добавляется одним нажатием.",
              ],
              [
                "Оформите заказ онлайн",
                "На следующем шаге выберите удобный пункт выдачи Ozon — стоимость и точная дата доставки рассчитываются сразу до оплаты.",
              ],
              [
                "Заберите и украсьте ёлку",
                "Изготовим ваш заказ за 2–4 дня и бережно отправим через Ozon Доставку. Уведомление о прибытии придёт в приложение Ozon.",
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
