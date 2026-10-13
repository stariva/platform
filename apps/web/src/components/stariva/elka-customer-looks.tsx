"use client";

import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import Image from "next/image";
import { type KeyboardEvent, type TouchEvent, useRef, useState } from "react";
import { ContactMasterButton } from "@/components/stariva/contact-master";
import { TrackedLink } from "@/components/stariva/tracked-link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { reachGoal } from "@/lib/analytics";
import { CUSTOMER_LOOKS } from "@/lib/elka/data";
import { cn } from "@/lib/utils";

/**
 * Раскладка плиток на десктопе (12 колонок). Первый ряд: два вертикальных кадра
 * одной ёлки и широкий кадр с гирляндой — высоту ряда задаёт он, соседи
 * растягиваются. Второй ряд — три одинаковых вертикальных кадра.
 * На телефоне все плитки 3:4 в горизонтальной ленте.
 */
const TILE_LAYOUT = [
  "lg:col-span-3 lg:aspect-auto",
  "lg:col-span-3 lg:aspect-auto",
  "lg:col-span-6 lg:aspect-[4/3]",
  "lg:col-span-4 lg:aspect-[4/5]",
  "lg:col-span-4 lg:aspect-[4/5]",
  "lg:col-span-4 lg:aspect-[4/5]",
];

const SWIPE_THRESHOLD = 50;

interface ElkaCustomerLooksProps {
  /** Страница — уходит в Метрику с целями галереи. */
  source: string;
  eyebrow: string;
  title: string;
  intro: string;
  cta: { href: string; label: string; goal: string };
}

/** Галерея «ёлки у покупателей» с идеями украшения и просмотром на весь экран. */
export function ElkaCustomerLooks({
  source,
  eyebrow,
  title,
  intro,
  cta,
}: ElkaCustomerLooksProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const total = CUSTOMER_LOOKS.length;
  const current = openIndex !== null ? CUSTOMER_LOOKS[openIndex] : undefined;

  const open = (index: number) => {
    setOpenIndex(index);
    reachGoal("elka_looks_open", {
      source,
      photo: CUSTOMER_LOOKS[index]?.slug,
    });
  };
  const step = (delta: number) =>
    setOpenIndex((index) =>
      index === null ? index : (index + delta + total) % total,
    );

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  };
  const onTouchStart = (event: TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: TouchEvent) => {
    const start = touchStartX.current;
    const end = event.changedTouches[0]?.clientX;
    touchStartX.current = null;
    if (start === null || end === undefined) return;
    if (Math.abs(end - start) > SWIPE_THRESHOLD) step(end < start ? 1 : -1);
  };

  return (
    <section
      aria-labelledby="customer-looks-title"
      className="bg-espresso text-parchment overflow-hidden"
    >
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 py-16 lg:py-24">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10 lg:mb-14">
          <div className="max-w-2xl">
            <p className="label-caps text-parchment/60 text-[11px] mb-4">
              {eyebrow}
            </p>
            <h2
              id="customer-looks-title"
              className="font-serif text-parchment leading-tight text-balance mb-4"
              style={{ fontSize: "clamp(30px, 4vw, 48px)" }}
            >
              {title}
            </h2>
            <p className="text-parchment/75 leading-relaxed text-pretty">
              {intro}
            </p>
          </div>
          <TrackedLink
            href={cta.href}
            goal={cta.goal}
            className="hidden lg:inline-flex shrink-0 items-center justify-center rounded-2xl bg-parchment hover:bg-white text-espresso px-8 py-4 transition-colors"
          >
            {cta.label}
          </TrackedLink>
        </div>

        <ul
          aria-label="Фото покупателей"
          onScroll={(event) => {
            const el = event.currentTarget;
            const max = el.scrollWidth - el.clientWidth;
            setProgress(max > 0 ? el.scrollLeft / max : 0);
          }}
          className="-mx-5 px-5 scroll-px-5 flex gap-4 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:px-0 lg:grid lg:grid-cols-12 lg:gap-5 lg:overflow-visible"
        >
          {CUSTOMER_LOOKS.map((look, index) => (
            <li
              key={look.slug}
              className={cn(
                "relative w-[78%] sm:w-[46%] shrink-0 snap-start aspect-[3/4] lg:w-auto",
                TILE_LAYOUT[index],
              )}
            >
              <button
                type="button"
                onClick={() => open(index)}
                aria-label={`${look.title} — открыть фото`}
                className="group absolute inset-0 overflow-hidden rounded-[24px] bg-near-black text-left cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-parchment focus-visible:ring-offset-2 focus-visible:ring-offset-espresso"
              >
                <Image
                  src={look.image}
                  alt={look.alt}
                  fill
                  sizes={
                    index === 2
                      ? "(min-width: 1024px) 50vw, (min-width: 640px) 46vw, 78vw"
                      : "(min-width: 1024px) 33vw, (min-width: 640px) 46vw, 78vw"
                  }
                  style={{ objectPosition: look.position }}
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
                <span
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-near-black/90 via-near-black/25 via-45% to-transparent"
                />
                {look.note ? (
                  <span className="absolute top-4 left-4 rounded-full bg-parchment/90 backdrop-blur px-3 py-1.5 text-xs text-espresso">
                    {look.note}
                  </span>
                ) : null}
                <span
                  aria-hidden
                  className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-near-black/35 backdrop-blur text-parchment transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-visible:opacity-100"
                >
                  <Maximize2 className="size-4" />
                </span>
                <span className="absolute inset-x-0 bottom-0 p-5 lg:p-6">
                  <span className="block font-serif text-xl lg:text-2xl text-white mb-1.5">
                    {look.title}
                  </span>
                  <span className="block text-sm text-white/80 leading-relaxed text-pretty">
                    {look.text}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        {/* Полоса прокрутки ленты на телефоне: видно, что кадров больше. */}
        <div
          aria-hidden
          className="lg:hidden mt-5 h-0.5 rounded-full bg-parchment/15 overflow-hidden"
        >
          <div
            className="h-full w-1/3 rounded-full bg-parchment/70"
            style={{ transform: `translateX(${progress * 200}%)` }}
          />
        </div>

        <div className="mt-8 lg:mt-14 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 lg:border-t border-parchment/10 lg:pt-8">
          <p className="text-parchment/70 text-sm leading-relaxed max-w-xl">
            Уже украсили свою ёлку макраме?{" "}
            <ContactMasterButton
              source={`${source}_looks`}
              message="Здравствуйте, Ольга! Хочу прислать фото своей ёлки макраме."
              className="text-parchment underline underline-offset-4 decoration-parchment/40 hover:text-white hover:decoration-white transition-colors"
            >
              Пришлите фото
            </ContactMasterButton>{" "}
            — Ольга добавит его в эту подборку.
          </p>
          <TrackedLink
            href={cta.href}
            goal={cta.goal}
            className="lg:hidden inline-flex items-center justify-center rounded-2xl bg-parchment hover:bg-white text-espresso px-8 py-4 transition-colors"
          >
            {cta.label}
          </TrackedLink>
        </div>
      </div>

      <Dialog
        open={openIndex !== null}
        onOpenChange={(next) => !next && setOpenIndex(null)}
      >
        <DialogContent
          onKeyDown={onKeyDown}
          overlayClassName="bg-near-black/90"
          className="max-w-[calc(100%-1.5rem)] sm:max-w-5xl gap-0 overflow-hidden rounded-[24px] border-0 bg-near-black p-0 text-parchment [&>[data-slot=dialog-close]]:z-10 [&>[data-slot=dialog-close]]:grid [&>[data-slot=dialog-close]]:size-10 [&>[data-slot=dialog-close]]:place-items-center [&>[data-slot=dialog-close]]:rounded-full [&>[data-slot=dialog-close]]:bg-near-black/50 [&>[data-slot=dialog-close]]:opacity-100 [&>[data-slot=dialog-close]_svg]:size-5"
        >
          {current && openIndex !== null ? (
            <>
              <div
                className="relative h-[min(72vh,820px)]"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                <Image
                  key={current.slug}
                  src={current.image}
                  alt={current.alt}
                  fill
                  sizes="(min-width: 1024px) 1024px, 100vw"
                  className="object-contain animate-in fade-in-0 duration-300"
                />
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Предыдущее фото"
                  className="absolute left-3 top-1/2 -translate-y-1/2 grid size-11 place-items-center rounded-full bg-parchment/90 text-espresso shadow-lg hover:bg-parchment transition-colors"
                >
                  <ChevronLeft className="size-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Следующее фото"
                  className="absolute right-3 top-1/2 -translate-y-1/2 grid size-11 place-items-center rounded-full bg-parchment/90 text-espresso shadow-lg hover:bg-parchment transition-colors"
                >
                  <ChevronRight className="size-5" aria-hidden />
                </button>
              </div>
              <div className="flex items-start justify-between gap-6 border-t border-parchment/10 px-5 py-4 lg:px-8 lg:py-5">
                <div>
                  <DialogTitle className="font-serif text-xl font-normal text-parchment mb-1">
                    {current.title}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-parchment/70 leading-relaxed">
                    {current.text}
                  </DialogDescription>
                </div>
                <span className="label-caps shrink-0 pt-1.5 text-parchment/50 tabular-nums">
                  {openIndex + 1} / {total}
                </span>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
