"use client";

import Image from "next/image";
import { type PointerEvent, useRef, useState } from "react";

/** Сколько фото показываем в карточке — остальные видны на странице товара. */
const MAX_IMAGES = 6;

const PLACEHOLDER = "/placeholder.jpg";

interface ProductCardImagesProps {
  images: string[];
  alt: string;
  sizes: string;
}

/**
 * Фото товара в карточке каталога, как на Lamoda: на десктопе кадр меняется
 * по положению курсора (ширина делится на зоны по числу фото), на тач-экранах —
 * свайпом. Полоски-индикаторы показывают, какой кадр открыт.
 */
export function ProductCardImages({
  images,
  alt,
  sizes,
}: ProductCardImagesProps) {
  const slides =
    images.length > 0
      ? [...new Set(images)].slice(0, MAX_IMAGES)
      : [PLACEHOLDER];
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  if (slides.length === 1) {
    const src = slides[0] as string;
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        sizes={sizes}
        unoptimized={src.startsWith("http")}
      />
    );
  }

  const show = (index: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollLeft = index * el.clientWidth;
    setActive(index);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    // Тач листается нативным скроллом, курсор — зонами.
    if (e.pointerType !== "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const zone = Math.floor(
      ((e.clientX - rect.left) / rect.width) * slides.length,
    );
    const index = Math.min(slides.length - 1, Math.max(0, zone));
    if (index !== active) show(index);
  };

  const handlePointerLeave = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") show(0);
  };

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div
      className="absolute inset-0"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex h-full overflow-x-auto overscroll-x-contain snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((src, i) => (
          <div key={src} className="relative h-full w-full shrink-0 snap-start">
            <Image
              src={src}
              alt={i === 0 ? alt : ""}
              fill
              className="object-cover"
              sizes={sizes}
              unoptimized={src.startsWith("http")}
            />
          </div>
        ))}
      </div>

      {/* Индикаторы: на десктопе появляются при наведении, на тач-экранах видны всегда */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-3 bottom-3 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
      >
        {slides.map((src, i) => (
          <span
            key={src}
            className={`h-[3px] flex-1 rounded-full shadow-[0_0_2px_rgb(0_0_0/0.35)] transition-colors duration-150 ${
              i === active ? "bg-white" : "bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
