import Link from "next/link";
import {
  getProducts,
  getRatingSummary,
  getReviews,
  type RatingSummary,
} from "@/lib/ozon-service";
import { formatRating, pluralRatings } from "@/lib/ratings";
import { TelegramIcon } from "./icons";
import { ReviewCard, Stars } from "./review-card";

function RatingPanel({ summary }: { summary: RatingSummary }) {
  return (
    <div className="flex items-center gap-4 lg:gap-5">
      <span className="font-serif text-6xl lg:text-7xl text-espresso leading-none tabular-nums">
        {formatRating(summary.average)}
      </span>
      <div className="flex flex-col gap-1.5">
        <Stars rating={summary.average} className="w-4 h-4" />
        <span className="text-sm text-taupe">
          {summary.count} {pluralRatings(summary.count)} на&nbsp;Ozon
        </span>
      </div>
    </div>
  );
}

interface ReviewsProps {
  /** How many reviews to show */
  limit?: number;
  /** Product page: show reviews for this Ozon offer_id */
  offerId?: string;
  /** Product page: Ozon SKUs for live Seller API reviews */
  skus?: number[];
  /** Override section heading */
  heading?: string;
}

export async function Reviews({
  limit = 6,
  offerId,
  skus,
  heading,
}: ReviewsProps) {
  const isProductPage = Boolean(offerId || skus?.length);
  const productReviews = isProductPage
    ? await getReviews({ offerId, skus })
    : [];
  // Нет отзывов на этот товар — показываем лучшие отзывы магазина
  const showProductReviews = productReviews.length > 0;
  const reviews = (
    showProductReviews ? productReviews : await getReviews()
  ).slice(0, limit);

  if (reviews.length === 0) return null;

  const summary = showProductReviews
    ? getRatingSummary(offerId)
    : getRatingSummary();

  // Ссылки на товары для общих блоков отзывов
  const productHrefs = new Map<string, string>();
  if (!showProductReviews) {
    for (const p of await getProducts()) {
      if (p.ozonOfferId)
        productHrefs.set(p.ozonOfferId, `/catalog/${p.category}/${p.slug}`);
    }
  }

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
              Отзывы с Ozon
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
              Больше отзывов — в моём Telegram-канале
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
              productHref={
                review.productOfferId
                  ? productHrefs.get(review.productOfferId)
                  : undefined
              }
            />
          ))}
        </div>

        <p className="mt-4 text-center label-caps text-taupe">
          Отзывы покупателей с&nbsp;
          <a
            href="https://www.ozon.ru"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-terracotta transition-colors"
          >
            Ozon
          </a>
        </p>
      </div>
    </section>
  );
}
