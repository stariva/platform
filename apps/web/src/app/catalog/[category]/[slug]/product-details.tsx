"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AddToCartButton } from "@/components/stariva/add-to-cart-button";
import { MadeToOrder } from "@/components/stariva/made-to-order";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { getMadeToOrder } from "@/lib/made-to-order";
import type { Category, Product } from "@/lib/ozon-types";
import { formatPrice } from "@/lib/products";

interface ProductDetailsProps {
  product: Product;
  category: Category;
  categorySlug: string;
  relatedProducts: Product[];
}

// ─── FAQ data per category ────────────────────────────────────────────────────
type FaqEntry = { q: string; a: string }[];

const categoryFaq: Record<string, FaqEntry> & { interior: FaqEntry } = {
  interior: [
    {
      q: "Из чего сделан абажур?",
      a: "Все изделия создаются из натурального хлопкового шнура без синтетических добавок и химических красителей. Хлопок безопасен для дома и не выделяет вредных веществ при нагреве.",
    },
    {
      q: "Как ухаживать за изделием из макраме?",
      a: "Раз в неделю аккуратно удаляйте пыль мягкой щёткой или феном на холодном режиме. При необходимости замочите в тёплой воде с мягким мылом на 15–20 минут, прополощите и сушите горизонтально. Не выжимайте.",
    },
    {
      q: "Можно ли заказать нестандартный размер?",
      a: "Да, мы принимаем индивидуальные заказы. Напишите в Telegram или позвоните — обсудим ваши пожелания и рассчитаем стоимость.",
    },
    {
      q: "Как долго ждать заказ?",
      a: "Готовые изделия отправляем в течение 1–3 дней. Изделия на заказ изготавливаются 2–4 дня в зависимости от сложности. Доставка по России через Ozon.",
    },
  ],
  clothes: [
    {
      q: "Как подобрать размер?",
      a: "Каждую вещь плетём под заказ: выберите стандартный размер или нажмите «Заказать по своим меркам» и укажите рост, обхват груди, талии и бёдер. Мастер проверит мерки и согласует детали до начала работы.",
    },
    {
      q: "Как стирать одежду из макраме?",
      a: "Рекомендуем ручную стирку в прохладной воде с мягким средством. Не отжимайте — аккуратно отожмите в полотенце и сушите в расправленном виде горизонтально.",
    },
    {
      q: "Можно ли носить в воде?",
      a: "Изделия из натурального хлопка можно носить на пляже и у бассейна. После контакта с морской водой или хлором прополощите в пресной воде и высушите.",
    },
    {
      q: "Можно ли выбрать другой цвет?",
      a: "Да. Любую модель сплетём в другом цвете шнура — выберите оттенок в карточке товара, точный цвет согласуем перед плетением. Изготовление занимает 2–4 дня.",
    },
  ],
  bags: [
    {
      q: "Насколько прочна сумка из макраме?",
      a: "Хлопковый шнур очень прочный — авоськи выдерживают до 5–7 кг. Изделия рассчитаны на ежедневное использование и служат годами при правильном уходе.",
    },
    {
      q: "Как ухаживать за сумкой?",
      a: "Стирайте вручную в тёплой воде с мягким мылом. Сушите в расправленном виде, избегая прямых солнечных лучей. Не используйте стиральную машину.",
    },
    {
      q: "Можно ли заказать нестандартный размер?",
      a: "Да, принимаем индивидуальные заказы на сумки любого размера и формы. Напишите нам в Telegram.",
    },
    {
      q: "Как быстро доставят заказ?",
      a: "Готовые изделия отправляем в течение 1–3 дней через Ozon. Доставка по всей России.",
    },
  ],
};

export function ProductDetails({
  product,
  category,
  categorySlug,
  relatedProducts,
}: ProductDetailsProps) {
  const [activeImage, setActiveImage] = useState(0);
  const faqItems = categoryFaq[categorySlug] ?? categoryFaq.interior;
  const madeToOrder = getMadeToOrder(categorySlug);
  const productUrl = `https://stariva.ru/catalog/${categorySlug}/${product.slug}`;

  return (
    <main className="min-h-screen bg-parchment">
      {/* Breadcrumb */}
      <section className="pt-28 pb-4 px-4">
        <div className="max-w-6xl mx-auto">
          <Breadcrumb>
            <BreadcrumbList className="text-sm text-taupe">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link
                    href="/catalog"
                    className="hover:text-espresso transition-colors"
                  >
                    Каталог
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>/</BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link
                    href={`/catalog/${categorySlug}`}
                    className="hover:text-espresso transition-colors"
                  >
                    {category.name}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>/</BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-espresso">
                  {product.name}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </section>

      {/* Product Section */}
      <section className="pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Gallery */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="min-w-0"
            >
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-sand mb-4">
                <Image
                  src={
                    product.images[activeImage] ??
                    product.images[0] ??
                    "/placeholder.jpg"
                  }
                  alt={product.name}
                  fill
                  className="object-cover"
                  priority
                  loading="eager"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  unoptimized={(
                    product.images[activeImage] ??
                    product.images[0] ??
                    "/placeholder.jpg"
                  ).startsWith("http")}
                />
                {product.oldPrice && (
                  <span className="absolute top-6 left-6 bg-terracotta text-white label-caps px-4 py-2 rounded-full">
                    Скидка{" "}
                    {Math.round((1 - product.price / product.oldPrice) * 100)}%
                  </span>
                )}
              </div>
              {product.images.length > 1 && (
                <div className="-m-1 flex gap-3 overflow-x-auto p-1 pb-2">
                  {product.images.map((img, i) => (
                    <Button
                      // biome-ignore lint/suspicious/noArrayIndexKey: image thumbnails are positional, index is the correct key
                      key={i}
                      variant="ghost"
                      size="icon"
                      type="button"
                      aria-label={`Показать фото ${i + 1} из ${product.images.length}`}
                      aria-pressed={activeImage === i}
                      onClick={() => setActiveImage(i)}
                      className={`size-20 shrink-0 rounded-lg border-2 bg-sand p-1 transition-colors duration-150 active:scale-[0.97] focus-visible:border-espresso focus-visible:ring-2 focus-visible:ring-espresso focus-visible:ring-offset-2 focus-visible:ring-offset-parchment focus-visible:transition-none motion-reduce:transition-none motion-reduce:active:scale-100 ${
                        activeImage === i
                          ? "border-espresso"
                          : "border-espresso/20 hover:border-espresso/50"
                      }`}
                    >
                      <span className="relative block size-full overflow-hidden rounded-sm">
                        <Image
                          src={img}
                          alt=""
                          fill
                          className="object-contain"
                          sizes="68px"
                          unoptimized={img.startsWith("http")}
                        />
                      </span>
                    </Button>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Info */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="flex flex-col"
            >
              <span className="label-caps text-terracotta mb-2">
                {
                  category.subcategories.find(
                    (s) => s.slug === product.subcategory,
                  )?.name
                }
              </span>

              <h1 className="font-serif text-3xl md:text-4xl text-espresso mb-4">
                {product.name}
              </h1>

              <div className="flex items-baseline gap-3 mb-2">
                <span className="font-serif text-3xl text-espresso">
                  {formatPrice(product.price)}
                </span>
                {product.oldPrice && (
                  <span className="text-taupe line-through text-xl">
                    {formatPrice(product.oldPrice)}
                  </span>
                )}
              </div>

              {/* Trust signals */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-sage label-caps">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 6.5l2.5 2.5 5.5-5.5"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Ручная работа
                </span>
                <span className="w-px h-3 bg-espresso/15" />
                <span className="inline-flex items-center gap-1.5 text-[11px] text-sage label-caps">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 6.5l2.5 2.5 5.5-5.5"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  100% хлопок
                </span>
                <span className="w-px h-3 bg-espresso/15" />
                <span className="inline-flex items-center gap-1.5 text-[11px] text-sage label-caps">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 6.5l2.5 2.5 5.5-5.5"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Доставка по России
                </span>
              </div>

              <p className="text-dark-grey leading-relaxed mb-8">
                {product.shortDescription}
              </p>

              {madeToOrder ? (
                <MadeToOrder
                  product={product}
                  config={madeToOrder}
                  productUrl={productUrl}
                />
              ) : (
                product.dimensions && (
                  <div className="flex flex-col items-center text-center p-4 bg-sand rounded-xl border border-espresso/6 mb-8">
                    <span className="label-caps text-[9px] text-taupe/60 mb-1">
                      Размеры
                    </span>
                    <span className="text-espresso text-[12px] leading-snug">
                      {product.dimensions}
                    </span>
                  </div>
                )
              )}

              {/* CTA Buttons */}
              <div className="space-y-3 mt-auto">
                <AddToCartButton product={product} />
                {!(product.ozonSku && product.inStock) && (
                  <Button
                    asChild
                    className="flex items-center justify-center gap-2 w-full bg-espresso hover:bg-terracotta text-white py-4 h-auto rounded-2xl transition-colors label-caps"
                  >
                    <a
                      href="https://t.me/Olga_Stariva"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Узнать наличие
                    </a>
                  </Button>
                )}

                <Button
                  asChild
                  variant="outline"
                  className="flex items-center justify-center gap-2 w-full border-espresso/20 text-espresso hover:bg-espresso hover:text-parchment py-3 h-auto rounded-2xl transition-colors label-caps"
                >
                  <a href="tel:+79778722546">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M4.5 5.5c0-1 .8-2 1.8-2h2c.5 0 .9.3 1 .8l.7 2.5c.2.6-.1 1.2-.6 1.5l-1.2.7c1 2.3 2.8 4.1 5.1 5.1l.7-1.2c.3-.5.9-.8 1.5-.6l2.5.7c.5.1.8.5.8 1v2c0 1-1 1.8-2 1.8C9.7 17.8 6.2 14.3 4.5 5.5Z"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Позвонить
                  </a>
                </Button>

                {/* Delivery info */}
                <div className="flex items-center justify-center gap-4 pt-1">
                  <span className="flex items-center gap-1.5 text-[10px] text-taupe label-caps">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <rect
                        x="3"
                        y="7"
                        width="12"
                        height="10"
                        rx="1"
                        stroke="currentColor"
                        strokeWidth="1.3"
                      />
                      <path
                        d="M15 11h3.5l2.5 3v3h-6"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx="7.5"
                        cy="17"
                        r="2"
                        stroke="currentColor"
                        strokeWidth="1.3"
                      />
                      <circle
                        cx="17.5"
                        cy="17"
                        r="2"
                        stroke="currentColor"
                        strokeWidth="1.3"
                      />
                    </svg>
                    Доставка по России
                  </span>
                  <span className="w-px h-3 bg-espresso/15" />
                  <span className="flex items-center gap-1.5 text-[10px] text-taupe label-caps">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M12 2L9.1 8.6 2 9.2l5.4 4.7-1.6 7L12 17.4l6.2 3.5-1.6-7L22 9.2l-7.1-.6L12 2Z"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinejoin="round"
                      />
                    </svg>
                    С 2018 года
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Description */}
      <section className="pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <h2 className="font-serif text-2xl text-espresso mb-6">Описание</h2>
            <div
              className="prose prose-lg text-dark-grey"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: product description comes from Ozon API (trusted source) and is sanitized server-side
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <h2 className="font-serif text-2xl text-espresso mb-6">
              Частые вопросы
            </h2>
            <div className="space-y-3">
              {faqItems.map((item) => (
                <details
                  key={item.q}
                  className="group border border-espresso/10 rounded-xl overflow-hidden"
                >
                  <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none text-espresso hover:bg-sand transition-colors">
                    <span className="text-sm font-medium leading-snug">
                      {item.q}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                      className="flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
                    >
                      <path
                        d="M3 6l5 5 5-5"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </summary>
                  <div className="px-5 pb-4 pt-1 text-taupe text-sm leading-relaxed border-t border-espresso/8">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="pb-24 px-4 bg-sand">
          <div className="max-w-6xl mx-auto pt-16">
            <div className="flex items-end justify-between mb-10">
              <div>
                <span className="label-caps text-terracotta mb-2 block">
                  Смотрите также
                </span>
                <h2 className="font-serif text-2xl lg:text-3xl text-espresso">
                  Похожие товары
                </h2>
              </div>
              <Link
                href={`/catalog/${categorySlug}`}
                className="hidden sm:inline-flex items-center gap-1.5 label-caps text-[11px] text-espresso/60 hover:text-terracotta transition-colors"
              >
                Все товары
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 6h8M7 3l3 3-3 3"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </Link>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedProducts.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.08 * i }}
                >
                  <Link
                    href={`/catalog/${p.category}/${p.slug}`}
                    className="group block bg-parchment rounded-2xl overflow-hidden border border-espresso/8 hover:shadow-[0_8px_32px_rgba(44,36,27,0.10)] hover:-translate-y-0.5 transition-all duration-300"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-sand">
                      <Image
                        src={p.images[0] ?? "/placeholder.jpg"}
                        alt={p.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        unoptimized={(
                          p.images[0] ?? "/placeholder.jpg"
                        ).startsWith("http")}
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-serif text-lg text-espresso mb-1 group-hover:text-terracotta transition-colors line-clamp-2">
                        {p.name}
                      </h3>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-serif text-lg text-espresso">
                          {formatPrice(p.price)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 text-center sm:hidden">
              <Link
                href={`/catalog/${categorySlug}`}
                className="inline-flex items-center gap-2 label-caps-md px-6 py-3 rounded-full border border-espresso/20 text-espresso hover:bg-espresso hover:text-parchment transition-colors"
              >
                Все товары категории
              </Link>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
