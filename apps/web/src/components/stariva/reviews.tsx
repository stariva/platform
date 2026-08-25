import Link from "next/link";
import { getReviews } from "@/lib/ozon-service";
import type { Review } from "@/lib/ozon-types";
import { TelegramIcon } from "./icons";
import { ReviewCard } from "./review-card";

// ─── Static fallback reviews ─────────────────────────────────────────────────
const STATIC_REVIEWS: Review[] = [
  {
    id: "static-1",
    rating: 5,
    text: "Получила абажур и заплакала — настолько он живой. Свет рассыпается по стенам узором, и спальня превратилась в волшебное место. Спасибо мастеру за душу, вложенную в работу.",
    date: "2024-11-15T00:00:00Z",
    reviewerName: "Анна, Санкт-Петербург",
    photos: ["/images/review-1.jpg"],
    source: "static",
  },
  {
    id: "static-2",
    rating: 5,
    text: "Долго искала что-то с характером, и Stariva стали находкой. Заказывала индивидуальный размер — обсуждали детали в Telegram, всё прислали аккуратно упакованным. Уют появился сразу.",
    date: "2024-10-22T00:00:00Z",
    reviewerName: "Мария, Москва",
    photos: ["/images/review-2.jpg"],
    source: "static",
  },
  {
    id: "static-3",
    rating: 5,
    text: "Уже второй заказ. Первый был на свадебный подарок подруге — она до сих пор пишет «лучший подарок в жизни». Этот взяла на свою кухню. Тепло, по-домашнему, по-настоящему.",
    date: "2024-09-10T00:00:00Z",
    reviewerName: "Екатерина, Казань",
    photos: ["/images/review-3.jpg"],
    source: "static",
  },
];

function AverageRating({ reviews }: { reviews: Review[] }) {
  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const rounded = Math.round(avg * 10) / 10;
  const total = reviews.length;
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 text-terracotta">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg
            // biome-ignore lint/suspicious/noArrayIndexKey: static 5 stars
            key={i}
            viewBox="0 0 24 24"
            fill={i < Math.round(avg) ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.5"
            className="w-3.5 h-3.5"
            aria-hidden="true"
          >
            <path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8L5.8 21l1.6-7L2 9.2l7.1-.6L12 2Z" />
          </svg>
        ))}
      </div>
      <span className="text-sm text-espresso font-medium">{rounded} / 5</span>
      <span className="text-sm text-taupe">
        ({total} отзыв{total === 1 ? "" : total < 5 ? "а" : "ов"})
      </span>
    </div>
  );
}

interface ReviewsProps {
  /** Limit how many live Ozon reviews to display */
  limit?: number;
  /** Show only reviews for specific SKUs (for product page) */
  skus?: number[];
  /** Override section heading */
  heading?: string;
}

export async function Reviews({ limit = 3, skus, heading }: ReviewsProps) {
  // Fetch live reviews; fall back to static on any failure
  const liveReviews = await getReviews(skus);
  const reviews: Review[] =
    liveReviews.length > 0
      ? liveReviews.slice(0, limit)
      : STATIC_REVIEWS.slice(0, limit);

  const isLive = liveReviews.length > 0;

  return (
    <section id="reviews" className="py-20 lg:py-32 bg-sand">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-14 lg:mb-20">
          <div>
            <div className="label-caps text-terracotta mb-4 flex items-center gap-3">
              <span className="w-8 h-px bg-terracotta" />
              {isLive ? "Отзывы с Ozon" : "Отзывы"}
            </div>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-espresso leading-[1.05] tracking-tight text-balance max-w-3xl">
              {heading ?? (
                <>
                  Что говорят <span className="italic">мои покупатели</span>
                </>
              )}
            </h2>
            {isLive && (
              <div className="mt-4">
                <AverageRating reviews={liveReviews} />
              </div>
            )}
          </div>
          <Link
            href="https://t.me/Olga_Stariva"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 label-caps-md text-espresso underline underline-offset-[6px] decoration-espresso/25 hover:decoration-terracotta hover:text-terracotta transition-colors"
          >
            <TelegramIcon className="w-4 h-4" />
            Все отзывы — в моём Telegram-канале
          </Link>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {reviews.map((review, i) => (
            <ReviewCard key={review.id} review={review} index={i} />
          ))}
        </div>

        {/* Ozon attribution */}
        {isLive && (
          <p className="mt-8 text-center label-caps text-taupe">
            Отзывы автоматически загружаются с&nbsp;
            <a
              href="https://www.ozon.ru"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-terracotta transition-colors"
            >
              Ozon
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
