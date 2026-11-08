import type { WorkshopReviewNotice } from "@stariva/web-api";
import type { OrderMessage } from "@/lib/commerce/order-message";

/** Мастеру: отзыв о мастер-классе ждёт проверки в админке. */
export function formatWorkshopReviewMessage(
  notice: WorkshopReviewNotice,
): OrderMessage {
  const { review } = notice;
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  const photos =
    review.photos.length > 0 ? `фото: ${review.photos.length}` : "без фото";
  return {
    title: notice.created
      ? `Новый отзыв о мастер-классе «${notice.workshopTitle}»`
      : `Изменён отзыв о мастер-классе «${notice.workshopTitle}»`,
    message: [
      `${stars} · ${review.reviewerName} · ${photos}`,
      `Email: ${notice.email}`,
      "",
      review.text,
      "",
      "На сайте отзыв появится, когда его включат в админке, в разделе «Отзывы».",
    ].join("\n"),
  };
}
