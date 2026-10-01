"use client";

import { ChevronLeft, ChevronRight, XIcon, ZoomIn } from "lucide-react";
import Image from "next/image";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

/** Во сколько раз увеличиваем фото при наведении курсора на карточку. */
const HOVER_ZOOM = 2.2;
/** Увеличение в полноэкранном просмотре (по клику / тапу). */
const LIGHTBOX_ZOOM = 2.8;
/** Сдвиг пальца (px), с которого жест считается свайпом, а не тапом. */
const SWIPE_DISTANCE = 50;
const TAP_SLOP = 6;

const PLACEHOLDER = "/placeholder.jpg";

interface ProductGalleryProps {
  images: string[];
  name: string;
  /** Бейдж поверх основного фото (например, скидка). */
  badge?: ReactNode;
}

interface Point {
  x: number;
  y: number;
}

function isRemote(src: string) {
  return src.startsWith("http");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Позиция курсора внутри элемента в процентах — это и есть transform-origin. */
function pointerPercent(e: PointerEvent<HTMLElement>): Point {
  const rect = e.currentTarget.getBoundingClientRect();
  return {
    x: clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100),
    y: clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100),
  };
}

/** Горизонтальный свайп пальцем: влево — дальше, вправо — назад. */
function useSwipe(onPrev: () => void, onNext: () => void) {
  const start = useRef<Point | null>(null);
  const swiped = useRef(false);

  return {
    /** true, если жест только что был свайпом — клик после него нужно проигнорировать. */
    consumeSwipe() {
      const was = swiped.current;
      swiped.current = false;
      return was;
    },
    handlers: {
      onPointerDown(e: PointerEvent) {
        if (e.pointerType === "mouse") return;
        start.current = { x: e.clientX, y: e.clientY };
        swiped.current = false;
      },
      onPointerUp(e: PointerEvent) {
        const from = start.current;
        start.current = null;
        if (!from) return;
        const dx = e.clientX - from.x;
        const dy = e.clientY - from.y;
        if (
          Math.abs(dx) < SWIPE_DISTANCE ||
          Math.abs(dx) < Math.abs(dy) * 1.5
        ) {
          return;
        }
        swiped.current = true;
        if (dx < 0) onNext();
        else onPrev();
      },
      onPointerCancel() {
        start.current = null;
      },
    },
  };
}

/**
 * Галерея карточки товара: на десктопе фото увеличивается под курсором,
 * по клику открывается полноэкранный просмотр с зумом, как у lamoda.ru.
 */
export function ProductGallery({ images, name, badge }: ProductGalleryProps) {
  const list = images.length > 0 ? images : [PLACEHOLDER];
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  // Точка увеличения не сбрасывается при уходе курсора, иначе фото «прыгает» при возврате в масштаб 1
  const [hoverOrigin, setHoverOrigin] = useState<Point>({ x: 50, y: 50 });

  const trackPointer = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    setHoverOrigin(pointerPercent(e));
    setHovered(true);
  };

  const index = Math.min(active, list.length - 1);
  const src = list[index] ?? PLACEHOLDER;
  const last = list.length - 1;

  const goTo = (next: number) => setActive(clamp(next, 0, last));
  const swipe = useSwipe(
    () => goTo(index - 1),
    () => goTo(index + 1),
  );

  return (
    <>
      <div className="relative mb-4 aspect-[3/4] overflow-hidden rounded-2xl bg-sand">
        <button
          type="button"
          aria-label={`Открыть фото ${index + 1} из ${list.length} на весь экран`}
          onClick={() => {
            if (swipe.consumeSwipe()) return;
            setOpen(true);
          }}
          onPointerEnter={trackPointer}
          onPointerMove={trackPointer}
          onPointerLeave={() => setHovered(false)}
          {...swipe.handlers}
          style={{ touchAction: "pan-y" }}
          className="absolute inset-0 block size-full cursor-zoom-in overflow-hidden focus-visible:ring-2 focus-visible:ring-espresso focus-visible:ring-inset"
        >
          <span
            className="absolute inset-0 transition-transform duration-200 ease-out will-change-transform motion-reduce:transition-none"
            style={{
              transform: `scale(${hovered ? HOVER_ZOOM : 1})`,
              transformOrigin: `${hoverOrigin.x}% ${hoverOrigin.y}%`,
            }}
          >
            <Image
              src={src}
              alt={name}
              fill
              draggable={false}
              className="object-cover"
              priority
              loading="eager"
              sizes="(max-width: 1024px) 100vw, 50vw"
              unoptimized={isRemote(src)}
            />
          </span>
        </button>

        {badge}

        {list.length > 1 && (
          <span className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-parchment/85 px-3 py-1 text-xs tabular-nums text-espresso backdrop-blur-sm lg:hidden">
            {index + 1} / {list.length}
          </span>
        )}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 bottom-4 flex size-9 items-center justify-center rounded-full bg-parchment/85 text-espresso backdrop-blur-sm"
        >
          <ZoomIn className="size-4" />
        </span>
      </div>

      {list.length > 1 && (
        <div className="-m-1 flex gap-3 overflow-x-auto scroll-p-1 p-1 pb-2">
          {list.map((img, i) => (
            <Button
              // biome-ignore lint/suspicious/noArrayIndexKey: image thumbnails are positional, index is the correct key
              key={i}
              variant="ghost"
              size="icon"
              type="button"
              aria-label={`Показать фото ${i + 1} из ${list.length}`}
              aria-pressed={index === i}
              onClick={() => setActive(i)}
              className={`size-20 shrink-0 scroll-m-1 rounded-lg border-2 bg-sand p-1 transition-colors duration-150 active:scale-[0.97] focus-visible:border-espresso focus-visible:ring-2 focus-visible:ring-espresso focus-visible:ring-offset-2 focus-visible:ring-offset-parchment focus-visible:transition-none motion-reduce:transition-none motion-reduce:active:scale-100 ${
                index === i
                  ? "border-espresso"
                  : "border-espresso/20 hover:border-espresso/50"
              }`}
            >
              <span className="relative block size-full overflow-hidden rounded-sm">
                <Image
                  src={img}
                  alt=""
                  fill
                  className="object-contain"
                  sizes="68px"
                  unoptimized={isRemote(img)}
                />
              </span>
            </Button>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-parchment p-0 sm:max-w-none"
        >
          <Lightbox
            images={list}
            name={name}
            index={index}
            onIndexChange={goTo}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

interface LightboxProps {
  images: string[];
  name: string;
  index: number;
  onIndexChange: (index: number) => void;
}

/** Содержимое просмотрщика. Монтируется только при открытии, поэтому зум сбрасывается сам. */
function Lightbox({ images, name, index, onIndexChange }: LightboxProps) {
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState<Point>({ x: 50, y: 50 });
  const [dragging, setDragging] = useState(false);
  const press = useRef<{ from: Point; origin: Point; moved: boolean } | null>(
    null,
  );

  const last = images.length - 1;
  const src = images[index] ?? PLACEHOLDER;

  const go = (next: number) => {
    if (next < 0 || next > last) return;
    setZoomed(false);
    onIndexChange(next);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") go(index - 1);
    else if (e.key === "ArrowRight") go(index + 1);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    press.current = {
      from: { x: e.clientX, y: e.clientY },
      origin,
      moved: false,
    };
    if (e.pointerType !== "mouse" && zoomed) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const current = press.current;
    if (current) {
      const dx = e.clientX - current.from.x;
      const dy = e.clientY - current.from.y;
      if (Math.hypot(dx, dy) > TAP_SLOP) current.moved = true;
    }
    if (!zoomed) return;

    if (e.pointerType === "mouse") {
      // Как у Lamoda: увеличенное фото «следует» за курсором
      setOrigin(pointerPercent(e));
    } else if (current) {
      // Палец тянет картинку: сдвиг точки-якоря в (zoom - 1) раз меньше сдвига пальца
      const rect = e.currentTarget.getBoundingClientRect();
      const k = LIGHTBOX_ZOOM - 1;
      setOrigin({
        x: clamp(
          current.origin.x -
            ((e.clientX - current.from.x) / rect.width / k) * 100,
          0,
          100,
        ),
        y: clamp(
          current.origin.y -
            ((e.clientY - current.from.y) / rect.height / k) * 100,
          0,
          100,
        ),
      });
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const current = press.current;
    press.current = null;
    setDragging(false);
    if (!current) return;

    const dx = e.clientX - current.from.x;
    const dy = e.clientY - current.from.y;

    if (!current.moved) {
      // Тап/клик: увеличиваем в точке нажатия или возвращаем как было
      if (zoomed) {
        setZoomed(false);
      } else {
        setOrigin(pointerPercent(e));
        setZoomed(true);
      }
      return;
    }

    const isSwipe =
      e.pointerType !== "mouse" &&
      !zoomed &&
      Math.abs(dx) >= SWIPE_DISTANCE &&
      Math.abs(dx) >= Math.abs(dy) * 1.5;
    if (isSwipe) go(dx < 0 ? index + 1 : index - 1);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: клавиатурная навигация по галерее, кнопки управления — внутри
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
      <DialogTitle className="sr-only">{name}</DialogTitle>
      <DialogDescription className="sr-only">
        Фото {index + 1} из {images.length}. Нажмите на фото, чтобы приблизить.
      </DialogDescription>

      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <span className="text-sm tabular-nums text-taupe">
          {index + 1} / {images.length}
        </span>
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Закрыть"
            className="size-10 rounded-full text-espresso hover:bg-sand"
          >
            <XIcon className="size-5" />
          </Button>
        </DialogClose>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          className="absolute inset-0 select-none overflow-hidden"
          style={{
            touchAction: "none",
            cursor: zoomed ? "zoom-out" : "zoom-in",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            press.current = null;
            setDragging(false);
          }}
        >
          <div
            className="absolute inset-x-4 inset-y-0 will-change-transform motion-reduce:transition-none sm:inset-x-16"
            style={{
              transform: `scale(${zoomed ? LIGHTBOX_ZOOM : 1})`,
              transformOrigin: `${origin.x}% ${origin.y}%`,
              transition: dragging ? "none" : "transform 200ms ease-out",
            }}
          >
            <Image
              src={src}
              alt={name}
              fill
              draggable={false}
              className="pointer-events-none object-contain"
              sizes="100vw"
              quality={90}
              unoptimized={isRemote(src)}
            />
          </div>
        </div>

        {index > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Предыдущее фото"
            onClick={() => go(index - 1)}
            className="absolute top-1/2 left-2 size-11 -translate-y-1/2 rounded-full bg-parchment/80 text-espresso shadow-sm hover:bg-sand sm:left-4"
          >
            <ChevronLeft className="size-6" />
          </Button>
        )}
        {index < last && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Следующее фото"
            onClick={() => go(index + 1)}
            className="absolute top-1/2 right-2 size-11 -translate-y-1/2 rounded-full bg-parchment/80 text-espresso shadow-sm hover:bg-sand sm:right-4"
          >
            <ChevronRight className="size-6" />
          </Button>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex justify-start gap-2 overflow-x-auto px-4 py-3 sm:justify-center sm:px-6">
          {images.map((img, i) => (
            <Button
              // biome-ignore lint/suspicious/noArrayIndexKey: image thumbnails are positional, index is the correct key
              key={i}
              variant="ghost"
              size="icon"
              type="button"
              aria-label={`Показать фото ${i + 1} из ${images.length}`}
              aria-pressed={index === i}
              onClick={() => go(i)}
              className={`size-16 shrink-0 rounded-lg border-2 bg-sand p-1 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-espresso focus-visible:ring-offset-2 focus-visible:ring-offset-parchment motion-reduce:transition-none ${
                index === i
                  ? "border-espresso"
                  : "border-espresso/20 hover:border-espresso/50"
              }`}
            >
              <span className="relative block size-full overflow-hidden rounded-sm">
                <Image
                  src={img}
                  alt=""
                  fill
                  className="object-contain"
                  sizes="56px"
                  unoptimized={isRemote(img)}
                />
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
