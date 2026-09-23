"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Review } from "@/lib/ozon-types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Renders an accessible five-star representation of a numeric rating. */
export function Stars({
  rating,
  className = "w-3.5 h-3.5",
}: {
  rating: number;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={`Оценка ${rating.toFixed(1).replace(".0", "")} из 5`}
      className="flex items-center gap-0.5 text-terracotta"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          // biome-ignore lint/suspicious/noArrayIndexKey: static 5-star row
          key={i}
          viewBox="0 0 24 24"
          fill={i < Math.round(rating) ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          className={className}
          aria-hidden="true"
        >
          <path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8L5.8 21l1.6-7L2 9.2l7.1-.6L12 2Z" />
        </svg>
      ))}
    </div>
  );
}

function OzonBadge() {
  return (
    <span className="inline-flex items-center gap-1 label-caps text-[9px] bg-[#005BFF]/8 text-[#005BFF] px-2 py-0.5 rounded-full">
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className="w-2.5 h-2.5"
        aria-hidden="true"
      >
        <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm0 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
      </svg>
      Ozon
    </span>
  );
}

const LONG_TEXT = 220;

/**
 * Ozon CDN отдаёт уменьшенную копию по префиксу wcNNN (NNN — длинная сторона):
 * оригиналы весят ~700 КБ, wc1000 — ~100 КБ, wc200 — ~8 КБ.
 */
function ozonPhoto(src: string, size: 200 | 1000) {
  return src.replace(
    /^(https:\/\/ir\.ozone\.ru\/s3\/[^/]+\/)(?!wc\d+\/)/,
    `$1wc${size}/`,
  );
}

interface ReviewCardProps {
  review: Review;
  index: number;
  /** Ссылка на товар — показываем в общих блоках отзывов */
  productHref?: string;
}

/** Displays an Ozon review with expandable text and a photo lightbox. */
export function ReviewCard({ review, index, productHref }: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);

  const photos = review.photos ?? [];
  const coverPhoto = photos[0];
  const lightboxPhoto = photoIndex !== null ? photos[photoIndex] : undefined;
  const isLong = review.text.length > LONG_TEXT;
  const isRemote = (src: string) => src.startsWith("http");

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.7,
        delay: (index % 3) * 0.1,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="break-inside-avoid mb-6 lg:mb-8 bg-parchment border border-linen/60 rounded-sm p-5 flex flex-col"
    >
      {/* Photos from buyer */}
      {coverPhoto && (
        <div className="mb-5">
          <button
            type="button"
            onClick={() => setPhotoIndex(0)}
            className="group relative block w-full aspect-[4/5] overflow-hidden rounded-sm cursor-zoom-in"
            aria-label={`Открыть фото покупателя — ${review.reviewerName}`}
          >
            <Image
              src={ozonPhoto(coverPhoto, 1000)}
              alt={`Фото покупателя — ${review.reviewerName}`}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              unoptimized={isRemote(coverPhoto)}
            />
          </button>
          {photos.length > 1 && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {photos.slice(1, 5).map((src, i) => {
                const hiddenCount = photos.length - 5;
                const showMore = i === 3 && hiddenCount > 0;
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setPhotoIndex(i + 1)}
                    className="relative aspect-square overflow-hidden rounded-sm cursor-zoom-in"
                    aria-label={`Фото ${i + 2} из ${photos.length}`}
                  >
                    <Image
                      src={ozonPhoto(src, 200)}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="80px"
                      unoptimized={isRemote(src)}
                    />
                    {showMore && (
                      <span className="absolute inset-0 grid place-items-center bg-espresso/55 text-parchment text-sm font-medium">
                        +{hiddenCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Rating */}
      <div className="flex items-center justify-between mb-3">
        <Stars rating={review.rating} />
        {review.source === "ozon" && <OzonBadge />}
      </div>

      {/* Text */}
      <p
        className={`font-serif italic text-lg lg:text-xl text-espresso leading-[1.45] text-pretty whitespace-pre-line ${
          isLong && !expanded ? "line-clamp-6" : ""
        }`}
      >
        &laquo;{review.text}&raquo;
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start mt-2 label-caps text-taupe underline underline-offset-4 decoration-taupe/40 hover:text-terracotta hover:decoration-terracotta transition-colors"
        >
          {expanded ? "Свернуть" : "Читать полностью"}
        </button>
      )}

      {/* Footer */}
      <div className="mt-5 pt-4 border-t border-espresso/10 flex items-end justify-between gap-4">
        <div>
          <div className="font-sans text-sm text-espresso font-medium">
            {review.reviewerName}
          </div>
          <div className="label-caps text-taupe mt-1">
            {formatDate(review.date)}
          </div>
        </div>
        {productHref && review.productTitle && (
          <Link
            href={productHref}
            className="text-right text-xs text-taupe hover:text-terracotta transition-colors max-w-[55%] leading-snug"
          >
            {review.productTitle}&nbsp;→
          </Link>
        )}
      </div>

      {/* Lightbox */}
      <Dialog
        open={photoIndex !== null}
        onOpenChange={(open) => !open && setPhotoIndex(null)}
      >
        <DialogContent className="max-w-3xl p-3 bg-parchment">
          <DialogTitle className="sr-only">
            Фото покупателя — {review.reviewerName}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Фото {(photoIndex ?? 0) + 1} из {photos.length}
          </DialogDescription>
          {photoIndex !== null && lightboxPhoto && (
            <div className="relative w-full h-[75vh]">
              <Image
                src={ozonPhoto(lightboxPhoto, 1000)}
                alt={`Фото покупателя ${photoIndex + 1} из ${photos.length}`}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 768px"
                unoptimized={isRemote(lightboxPhoto)}
              />
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoIndex(
                        (photoIndex - 1 + photos.length) % photos.length,
                      )
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full bg-parchment/90 text-espresso shadow hover:bg-parchment"
                    aria-label="Предыдущее фото"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoIndex((photoIndex + 1) % photos.length)
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full bg-parchment/90 text-espresso shadow hover:bg-parchment"
                    aria-label="Следующее фото"
                  >
                    →
                  </button>
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 label-caps bg-parchment/90 text-espresso px-2 py-1 rounded-full">
                    {photoIndex + 1} / {photos.length}
                  </span>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.article>
  );
}
