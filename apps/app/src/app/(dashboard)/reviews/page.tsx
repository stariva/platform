import { SiteHeader } from "~/components/layout";
import { ReviewsTable } from "~/components/reviews/reviews-table";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const [reviews, products] = await Promise.all([
    api.admin.reviews.list(),
    api.admin.products.list(),
  ]);

  return (
    <>
      <SiteHeader title="Отзывы" />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Отзывы</h1>
          <p className="text-muted-foreground text-sm">
            На сайте виден только тот отзыв, у которого включён переключатель.
            Фото и имя покупателя — его персональные данные: включайте их, если
            он согласен на публикацию, а иначе оставьте отзыв без фото. Отзыв
            виден на карточках привязанных товаров; без товара — только в общих
            блоках «Отзывы о мастерской».
          </p>
        </div>
        <ReviewsTable
          initialReviews={reviews.map((review) => ({
            ...review,
            reviewedAt: review.reviewedAt.toISOString(),
          }))}
          products={products.map(({ id, name, ozonOfferId }) => ({
            id,
            name,
            ozonOfferId,
          }))}
        />
      </div>
    </>
  );
}
