import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { BreadcrumbJsonLd } from "@/components/stariva/json-ld";
import { RatingPanel, SOURCE_PROFILES } from "@/components/stariva/reviews";
import { ReviewCard } from "@/components/stariva/review-card";
import { getAllReviews, getProducts, summarizeRatings } from "@/lib/ozon-service";
import {
  pageWindow,
  paginateReviews,
  parseReviewsQuery,
  type ReviewsQuery,
  reviewsHref,
} from "@/lib/reviews-listing";
import { SITE_URL as BASE_URL } from "@/lib/site-url";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TITLE = "Отзывы покупателей";
const DESCRIPTION =
  "Все отзывы покупателей о макраме-изделиях мастерской Stariva: пояса, сумки, абажуры и декор. Реальные оценки и фото с Ozon и Авито.";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const query = parseReviewsQuery(await searchParams);
  const filtered = query.photos || query.rating !== undefined;
  return {
    title: TITLE,
    description: DESCRIPTION,
    // Страницы с фильтрами — дубли ленты, в поиск их не зовём
    robots: filtered ? { index: false, follow: true } : undefined,
    alternates: {
      canonical: `${BASE_URL}${filtered ? "/reviews" : reviewsHref({ page: query.page })}`,
    },
    openGraph: {
      type: "website",
      title: TITLE,
      description: DESCRIPTION,
      url: `${BASE_URL}/reviews`,
    },
  };
}

const RATING_FILTERS = [5, 4, 3, 2, 1];

function chipClass(active: boolean) {
  return `inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors ${
    active
      ? "border-espresso bg-espresso text-parchment"
      : "border-espresso/25 text-espresso hover:border-terracotta hover:text-terracotta"
  }`;
}

/** Фильтры — обычные ссылки: работают без JS, а состояние живёт в URL. */
function Filters({
  query,
  ratingCounts,
}: {
  query: ReviewsQuery;
  ratingCounts: Map<number, number>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={reviewsHref({ rating: query.rating })}
        className={chipClass(!query.photos)}
        aria-current={!query.photos ? "true" : undefined}
      >
        Все
      </Link>
      <Link
        href={reviewsHref({ photos: true, rating: query.rating })}
        className={chipClass(query.photos)}
        aria-current={query.photos ? "true" : undefined}
      >
        С фото
      </Link>
      <span className="mx-1 hidden h-5 w-px bg-espresso/15 sm:block" />
      {RATING_FILTERS.map((rating) => {
        const active = query.rating === rating;
        return (
          <Link
            key={rating}
            // Повторный клик по активной оценке снимает фильтр
            href={reviewsHref({
              photos: query.photos,
              rating: active ? undefined : rating,
            })}
            className={chipClass(active)}
            aria-current={active ? "true" : undefined}
          >
            {rating}
            <span aria-hidden="true">★</span>
            <span className="sr-only">
              {rating === 1 ? "звезда" : rating < 5 ? "звезды" : "звёзд"}
            </span>
            <span className="opacity-60 tabular-nums">
              {ratingCounts.get(rating) ?? 0}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function Pagination({ page, pageCount, query }: ReviewsPageNavProps) {
  if (pageCount <= 1) return null;
  const link = (target: number) => reviewsHref({ ...query, page: target });
  const base =
    "grid h-10 min-w-10 place-items-center rounded-full px-3 text-sm transition-colors";

  return (
    <nav
      aria-label="Страницы отзывов"
      className="mt-12 flex flex-wrap items-center justify-center gap-1.5"
    >
      {page > 1 && (
        <Link
          href={link(page - 1)}
          rel="prev"
          className={`${base} text-espresso hover:text-terracotta`}
        >
          ← Назад
        </Link>
      )}
      {pageWindow(page, pageCount).map((target, i) =>
        target === null ? (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: пропуски «…» не имеют идентичности
            key={`gap-${i}`}
            className={`${base} text-taupe`}
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <Link
            key={target}
            href={link(target)}
            aria-current={target === page ? "page" : undefined}
            aria-label={`Страница ${target}`}
            className={`${base} tabular-nums ${
              target === page
                ? "bg-espresso text-parchment"
                : "text-espresso hover:text-terracotta"
            }`}
          >
            {target}
          </Link>
        ),
      )}
      {page < pageCount && (
        <Link
          href={link(page + 1)}
          rel="next"
          className={`${base} text-espresso hover:text-terracotta`}
        >
          Дальше →
        </Link>
      )}
    </nav>
  );
}

interface ReviewsPageNavProps {
  page: number;
  pageCount: number;
  query: ReviewsQuery;
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = parseReviewsQuery(await searchParams);

  // Как и на главной, только отзывы с маркетплейсов, без оставленных на сайте
  const all = await getAllReviews({ verifiedOnly: true });
  const result = paginateReviews(all, query);
  // Страница за пределами списка (старая ссылка, сменился фильтр) — на последнюю
  if (result.page !== query.page) {
    redirect(reviewsHref({ ...query, page: result.page }));
  }

  // Счётчики на чипах считаем с учётом «С фото», но без выбранной оценки
  const ratingCounts = new Map<number, number>();
  for (const review of all) {
    if (query.photos && review.photos.length === 0) continue;
    ratingCounts.set(review.rating, (ratingCounts.get(review.rating) ?? 0) + 1);
  }

  const summary = summarizeRatings(all);
  const sourceProfiles = (summary?.sources ?? []).flatMap(
    (source) => SOURCE_PROFILES[source] ?? [],
  );

  const productHrefs = new Map<string, string>();
  for (const p of await getProducts()) {
    productHrefs.set(p.id, `/catalog/${p.category}/${p.slug}`);
  }

  return (
    <div className="bg-parchment text-espresso pt-[60px] lg:pt-[68px]">
      <Header variant="solid" />
      <BreadcrumbJsonLd
        items={[
          { name: "Главная", href: "/" },
          { name: "Отзывы", href: "/reviews" },
        ]}
      />

      <section className="py-16 lg:py-24 bg-sand">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-10 lg:mb-14">
            <div>
              <div className="label-caps text-terracotta mb-4 flex items-center gap-3">
                <span className="w-8 h-px bg-terracotta" />
                Отзывы покупателей
              </div>
              <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-espresso leading-[1.05] tracking-tight text-balance max-w-3xl">
                Что говорят <span className="italic">мои покупатели</span>
              </h1>
            </div>
            {summary && <RatingPanel summary={summary} />}
          </div>

          <div className="mb-10 lg:mb-12">
            <Filters query={query} ratingCounts={ratingCounts} />
          </div>

          {result.reviews.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-serif text-2xl text-espresso">
                {all.length === 0
                  ? "Отзывы скоро появятся"
                  : "Под выбранные фильтры отзывов нет"}
              </p>
              {all.length > 0 && (
                <Link
                  href="/reviews"
                  className="mt-4 inline-block label-caps-md text-espresso underline underline-offset-[6px] decoration-espresso/25 hover:decoration-terracotta hover:text-terracotta transition-colors"
                >
                  Сбросить фильтры
                </Link>
              )}
            </div>
          ) : (
            <>
              <p className="mb-6 label-caps text-taupe" aria-live="polite">
                Показано {result.reviews.length} из {result.total}
              </p>
              <div className="columns-1 md:columns-2 lg:columns-3 gap-6 lg:gap-8">
                {result.reviews.map((review, i) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    index={i}
                    productHref={productHrefs.get(review.productIds[0] ?? "")}
                  />
                ))}
              </div>
              <Pagination
                page={result.page}
                pageCount={result.pageCount}
                query={query}
              />
            </>
          )}

          {sourceProfiles.length > 0 && (
            <p className="mt-10 text-center label-caps text-taupe">
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

      <Footer />
    </div>
  );
}
