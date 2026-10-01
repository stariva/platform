"use client";

import {
  Badge,
  Button,
  Input,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "~/orpc/react";

export interface AdminReview {
  id: string;
  source: "ozon" | "site";
  rating: number;
  text: string;
  reviewerName: string;
  productOfferId: string | null;
  productTitle: string | null;
  photos: string[];
  reviewedAt: string;
  published: boolean;
  showPhotos: boolean;
}

type Filter = "all" | "published" | "hidden";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "published", label: "На сайте" },
  { id: "hidden", label: "Скрытые" },
];

/** Ozon отдаёт уменьшенную копию по префиксу wc200 — для миниатюр хватает. */
function thumbnail(src: string) {
  return src.replace(
    /^(https:\/\/ir\.ozone\.ru\/s3\/[^/]+\/)(?!wc\d+\/)/,
    "$1wc200/",
  );
}

const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" });

/** Отзывы с переключателями «показывать на сайте» и «показывать фото». */
export function ReviewsTable({
  initialReviews,
}: {
  initialReviews: AdminReview[];
}) {
  const [reviews, setReviews] = useState(initialReviews);
  const [filter, setFilter] = useState<Filter>("all");

  const update = useMutation({
    ...orpc.admin.reviews.update.mutationOptions(),
    onSuccess: ({ review, revalidated }) => {
      toast.success(
        revalidated
          ? "Сохранено, сайт обновлён"
          : "Сохранено. На сайте изменение появится в течение часа",
      );
      setReviews((current) =>
        current.map((r) =>
          r.id === review.id
            ? { ...r, ...review, reviewedAt: review.reviewedAt.toISOString() }
            : r,
        ),
      );
    },
    onError: (error: Error) => toast.error(error.message || "Не сохранилось"),
  });

  const visible = reviews.filter(
    (r) =>
      filter === "all" || (filter === "published" ? r.published : !r.published),
  );
  const publishedCount = reviews.filter((r) => r.published).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(({ id, label }) => (
          <Button
            key={id}
            size="sm"
            variant={filter === id ? "default" : "outline"}
            onClick={() => setFilter(id)}
          >
            {label}
          </Button>
        ))}
        <span className="text-muted-foreground ml-2 text-sm">
          {reviews.length} всего · на сайте {publishedCount}
        </span>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Фото</TableHead>
              <TableHead>Отзыв</TableHead>
              <TableHead className="w-44">Подпись</TableHead>
              <TableHead className="w-24 text-center">На сайте</TableHead>
              <TableHead className="w-28 text-center">Фото на сайте</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground py-8 text-center"
                >
                  Отзывов нет
                </TableCell>
              </TableRow>
            )}
            {visible.map((review) => (
              <TableRow key={review.id}>
                <TableCell className="align-top">
                  {review.photos.length === 0 ? (
                    <span className="text-muted-foreground text-xs">
                      без фото
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {review.photos.map((src) => (
                        <a
                          key={src}
                          href={src}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {/* biome-ignore lint/performance/noImgElement: миниатюра из внешнего бакета без оптимизации */}
                          <img
                            src={thumbnail(src)}
                            alt="Фото из отзыва"
                            className="h-14 w-14 rounded object-cover"
                            loading="lazy"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="max-w-[520px] align-top whitespace-normal">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span
                      role="img"
                      aria-label={`Оценка ${review.rating} из 5`}
                      className="text-amber-500"
                    >
                      {"★".repeat(review.rating)}
                      <span className="text-muted-foreground/40">
                        {"★".repeat(5 - review.rating)}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {dateFormat.format(new Date(review.reviewedAt))}
                    </span>
                    {review.source === "ozon" && (
                      <Badge variant="outline">Ozon</Badge>
                    )}
                    {review.productTitle && (
                      <span className="text-muted-foreground text-xs">
                        {review.productTitle}
                        {review.productOfferId && ` · ${review.productOfferId}`}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-line">
                    {review.text}
                  </p>
                </TableCell>
                <TableCell className="align-top">
                  <Input
                    defaultValue={review.reviewerName}
                    maxLength={80}
                    aria-label="Подпись автора"
                    onBlur={(event) => {
                      const name = event.target.value.trim();
                      if (name === "") {
                        event.target.value = review.reviewerName;
                      } else if (name !== review.reviewerName) {
                        update.mutate({ id: review.id, reviewerName: name });
                      }
                    }}
                  />
                </TableCell>
                <TableCell className="text-center align-top">
                  <Switch
                    checked={review.published}
                    disabled={update.isPending}
                    aria-label="Показывать отзыв на сайте"
                    onCheckedChange={(published) =>
                      update.mutate({ id: review.id, published })
                    }
                  />
                </TableCell>
                <TableCell className="text-center align-top">
                  <Switch
                    checked={review.showPhotos}
                    disabled={update.isPending || review.photos.length === 0}
                    aria-label="Показывать фото на сайте"
                    onCheckedChange={(showPhotos) =>
                      update.mutate({ id: review.id, showPhotos })
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
