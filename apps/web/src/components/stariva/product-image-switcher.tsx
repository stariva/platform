"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ProductImageSwitcherProps {
  images: string[];
  alt: string;
  sizes: string;
  className?: string;
  imageClassName?: string;
}

const fallbackImage = "/placeholder.jpg";

/**
 * Changes the preview photo according to the cursor position, like product
 * cards on large fashion marketplaces. Touch devices keep the first preview.
 */
export function ProductImageSwitcher({
  images,
  alt,
  sizes,
  className,
  imageClassName,
}: ProductImageSwitcherProps) {
  const previewImages = images.length > 0 ? images : [fallbackImage];
  const [activeIndex, setActiveIndex] = useState(0);
  const hasPreloaded = useRef(false);
  const activeImage = previewImages[activeIndex] ?? fallbackImage;

  function preloadImages() {
    if (hasPreloaded.current || previewImages.length < 2) return;

    hasPreloaded.current = true;
    for (const image of previewImages.slice(1)) {
      const preview = new window.Image();
      preview.src = image;
    }
  }

  function selectImage(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || previewImages.length < 2) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const relativePosition = (event.clientX - bounds.left) / bounds.width;
    const nextIndex = Math.min(
      previewImages.length - 1,
      Math.max(0, Math.floor(relativePosition * previewImages.length)),
    );

    setActiveIndex((currentIndex) =>
      currentIndex === nextIndex ? currentIndex : nextIndex,
    );
  }

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      onPointerEnter={preloadImages}
      onPointerMove={selectImage}
      onPointerLeave={() => setActiveIndex(0)}
    >
      <Image
        src={activeImage}
        alt={alt}
        fill
        className={cn("object-cover", imageClassName)}
        sizes={sizes}
        unoptimized={activeImage.startsWith("http")}
      />
    </div>
  );
}
