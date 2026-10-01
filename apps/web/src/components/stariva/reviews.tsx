import Link from "next/link";
import {
  getAllReviews,
  getProducts,
  getRatingSummary,
  getReviews,
  type RatingSummary,
} from "@/lib/ozon-service";
import type { Review } from "@/lib/ozon-types";
import { formatRating, pluralRatings, ratingSourcesLabel } from "@/lib/ratings";
import { TelegramIcon } from "./icons";
import { ReviewCard, Stars } from "./review-card";

/** Магазины, откуда перенесены отзывы, — ссылки под блоком. */
export const SOURCE_PROFILES: Partial<
  Record<Review["source"], { name: string; href: string }>
> = {
  ozon: {
    name: "Ozon",
    href: "https://www.ozon.ru/seller/stariva-makrame-odezhda-dekor-vyazanye-sumki-izdeliya-iz-shnura/",
  },
  avito: {
    name: "Авито",
    href: "https://www.avito.ru/brands/i3320470/all?sellerId=5c2374e4adcfe4219ff7e1702a15d27f",
  },
};

/** Displays the average rating and total number of marketplace ratings. */
export function RatingPanel({ summary }: { summary: RatingSummary }) {
  return (
    <div className="flex items-center gap-4 lg:gap-5">
      <span className="font-serif text-6xl lg:text-7xl text-espresso leading-none tabular-nums">
        {formatRating(summary.average)}
      </span>
      <div className="flex flex-col gap-1.5">
        <Stars rating={summary.average} className="w-4 h-4" />
        <span className="text-sm text-taupe">
          {summary.count} {pluralRatings(summary.count)}{" "}
          {ratingSourcesLabel(summary.sources)}
        </span>
      </div>
    </div>
  );
}

interface ReviewsProps {
  /** Homepage must not present unverified fallback stories as customer evidence. */
  verifiedOnly?: boolean;
  /** How many reviews to show */
  limit?: number;
  /** Product page: show reviews linked to this product (products.id) */
  productId?: string;
  /** Override section heading */
  heading?: string;
}

/** Shows product reviews when available, otherwise store-wide reviews. */
export async function Reviews({
  limit = 6,
  productId,
  heading,
  verifiedOnly = false,
}: ReviewsProps) {
  const isProductPage = Boolean(productId);
  const productReviews = isProductPage ? await getReviews({ productId }) : [];
  // Нет отзывов на этот товар — показываем лучшие отзывы магазина
  const showProductReviews = productReviews.length > 0;
  // Подтверждённые — с маркетплейсов, где отзыв оставляют только после покупки
  const reviews = (showProductReviews ? productReviews : await getReviews())
    .filter((review) => !verifiedOnly || review.source !== "site")
    .slice(0, limit);

  if (reviews.length === 0) return null;

  // Страница /reviews показывает те же отзывы целиком — зовём туда, если есть что ещё почитать
  const totalReviews = (await getAllReviews({ verifiedOnly })).length;

  const summary = showProductReviews
    ? await getRatingSummary(productId)
    : await getRatingSummary();

  // Ссылки на товары для общих блоков отзывов
  const productHrefs = new Map<string, string>();
  if (!showProductReviews) {
    for (const p of await getProducts()) {
      productHrefs.set(p.id, `/catalog/${p.category}/${p.slug}`);
    }
  }

  // Те же площадки, что и в подписи к рейтингу
  const sourceProfiles = (summary?.sources ?? []).flatMap(
    (source) => SOURCE_PROFILES[source] ?? [],
  );

  const title = showProductReviews
    ? (heading ?? "Отзывы о товаре")
    : isProductPage
      ? "Отзывы о мастерской"
      : heading;

  return (
    <section id="reviews" className="py-20 lg:py-32 bg-sand">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-14 lg:mb-20">
          <div>
            <div className="label-caps text-terracotta mb-4 flex items-center gap-3">
              <span className="w-8 h-px bg-terracotta" />
              Отзывы покупателей
            </div>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-espresso leading-[1.05] tracking-tight text-balance max-w-3xl">
              {title ?? (
                <>
                  Что говорят <span className="italic">мои покупатели</span>
                </>
              )}
            </h2>
            {isProductPage && !showProductReviews && (
              <p className="mt-4 text-taupe max-w-xl">
                У этой модели ещё нет отзывов — вот что пишут о других изделиях
                мастерской.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-5 lg:items-end">
            {summary && <RatingPanel summary={summary} />}
            <Link
              href="https://t.me/Olga_Stariva"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 label-caps-md text-espresso underline underline-offset-[6px] decoration-espresso/25 hover:decoration-terracotta hover:text-terracotta transition-colors"
            >
              <TelegramIcon className="w-4 h-4" />
              Обсудить заказ с мастером
            </Link>
          </div>
        </div>

        {/* Cards — masonry */}
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 lg:gap-8">
          {reviews.map((review, i) => (
            <ReviewCard
              key={review.id}
              review={review}
              index={i}
              productHref={productHrefs.get(review.productIds[0] ?? "")}
            />
          ))}
        </div>

        {totalReviews > reviews.length && (
          <div className="mt-6 text-center">
            <Link
              href="/reviews"
              className="inline-flex items-center gap-2 label-caps-md text-espresso border border-espresso/25 rounded-full px-6 py-3 hover:border-terracotta hover:text-terracotta transition-colors"
            >
              Все отзывы ({totalReviews}) &rarr;
            </Link>
          </div>
        )}

        {sourceProfiles.length > 0 && (
          <p className="mt-4 text-center label-caps text-taupe">
            Отзывы покупателей с&nbsp;
            {sourceProfiles.map(({ name, href }, i) => (
              <span key={name}>
                {i > 0 && " и "}
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-terracotta transition-colors"
                >
                  {name}
                </a>
              </span>
            ))}
          </p>
        )}
      </div>
    </section>
  );
}
