"use client";

import { motion } from "motion/react";
import Image from "next/image";
import type { Review } from "@/lib/ozon-types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Stars({ rating }: { rating: number }) {
  return (
    <div
      role="img"
      aria-label={`Оценка ${rating} из 5`}
      className="flex items-center gap-1 text-terracotta"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          // biome-ignore lint/suspicious/noArrayIndexKey: static 5-star row
          key={i}
          viewBox="0 0 24 24"
          fill={i < rating ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          className="w-3.5 h-3.5"
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

interface ReviewCardProps {
  review: Review;
  index: number;
}

export function ReviewCard({ review, index }: ReviewCardProps) {
  const coverPhoto = review.photos?.[0];

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.7,
        delay: index * 0.1,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`bg-parchment border border-linen/60 rounded-sm p-5 flex flex-col ${
        index === 1 ? "md:mt-10" : ""
      }`}
    >
      {/* Photo (from buyer or static) */}
      {coverPhoto && (
        <div className="relative aspect-[4/5] overflow-hidden rounded-sm mb-5">
          <Image
            src={coverPhoto}
            alt={`Фото к отзыву — ${review.reviewerName}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized={coverPhoto.startsWith("http")}
          />
        </div>
      )}

      {/* Rating */}
      <div className="flex items-center justify-between mb-3">
        <Stars rating={review.rating} />
        {review.source === "ozon" && <OzonBadge />}
      </div>

      {/* Text */}
      <p className="font-serif italic text-lg lg:text-xl text-espresso leading-[1.45] mb-5 text-pretty flex-1">
        &laquo;{review.text}&raquo;
      </p>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-espresso/10 flex items-center justify-between">
        <div>
          <div className="font-sans text-sm text-espresso font-medium">
            {review.reviewerName}
          </div>
          <div className="label-caps text-taupe mt-1">
            {formatDate(review.date)}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
