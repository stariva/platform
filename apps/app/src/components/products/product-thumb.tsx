"use client";

import { useState } from "react";

const PREVIEW_SIZE = 288;
const GAP = 12;

/** Миниатюра в таблице: при наведении показывает увеличенное фото рядом с курсором. */
export function ProductThumb({ src }: { src: string | null }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  if (!src) {
    return <div className="bg-muted size-10 rounded" />;
  }

  const show = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const left =
      rect.right + GAP + PREVIEW_SIZE > window.innerWidth
        ? rect.left - GAP - PREVIEW_SIZE
        : rect.right + GAP;
    const top = Math.min(
      Math.max(GAP, rect.top + rect.height / 2 - PREVIEW_SIZE / 2),
      window.innerHeight - PREVIEW_SIZE - GAP,
    );
    setPos({ left, top });
  };

  return (
    <div
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={() => setPos(null)}
    >
      {/* biome-ignore lint/performance/noImgElement: превью из внешнего бакета без оптимизации */}
      <img
        src={src}
        alt=""
        className="size-10 rounded object-cover"
        loading="lazy"
      />
      {pos && (
        // biome-ignore lint/performance/noImgElement: превью из внешнего бакета без оптимизации
        <img
          src={src}
          alt=""
          style={{ left: pos.left, top: pos.top, width: PREVIEW_SIZE }}
          className="bg-background pointer-events-none fixed z-50 aspect-square rounded-lg border object-cover shadow-xl"
        />
      )}
    </div>
  );
}
