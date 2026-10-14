"use client";

import { ArrowRightIcon, ImageOffIcon, XIcon } from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  type PanInfo,
  useReducedMotion,
} from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { reachGoal } from "@/lib/analytics";
import { cartLineKey, useCart } from "@/lib/cart/cart-context";
import { type AddedToCart, onCartLanded } from "@/lib/cart/fly-to-cart";
import { pluralItems } from "@/lib/in-stock";
import { formatPrice } from "@/lib/products";

/** Сколько панель висит, если покупатель её не трогает. */
const AUTO_CLOSE_MS = 6000;
const DESKTOP_WIDTH = 380;
const GUTTER = 12;

interface Placement {
  top: number;
  left: number;
  width: number;
  /** Где под значком корзины стоит «хвостик» панели, от её левого края. */
  caretX: number;
}

/** Ставит панель под шапкой так, чтобы «хвостик» указывал на значок корзины. */
function placeUnder(anchor: HTMLElement): Placement {
  const icon = anchor.getBoundingClientRect();
  const header = anchor.closest("header")?.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const top = (header?.bottom ?? icon.bottom) + 10;
  const iconX = icon.left + icon.width / 2;

  if (vw < 640) {
    const width = vw - GUTTER * 2;
    return {
      top,
      left: GUTTER,
      width,
      caretX: Math.min(Math.max(iconX - GUTTER, 24), width - 24),
    };
  }
  const width = DESKTOP_WIDTH;
  const left = Math.min(
    Math.max(icon.right + 20 - width, GUTTER),
    vw - width - GUTTER,
  );
  return {
    top,
    left,
    width,
    caretX: Math.min(Math.max(iconX - left, 24), width - 24),
  };
}

type Shown = AddedToCart & { id: number };

/**
 * Панель «Добавлено в корзину» под значком корзины. Появляется, когда
 * изделие долетело, и сама закрывается через несколько секунд; таймер
 * замирает, пока на панель навели курсор или в ней фокус. На телефоне
 * панель можно смахнуть вверх.
 */
export function CartAddedPanel({
  anchorRef,
}: {
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const { items, count, subtotal } = useCart();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [swiped, setSwiped] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<Animation | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => setMounted(true), []);

  const close = useCallback((how: "fade" | "swipe" = "fade") => {
    setSwiped(how === "swipe");
    setShown(null);
  }, []);

  useEffect(
    () =>
      onCartLanded((item) => {
        setSwiped(false);
        setShown({ ...item, id: Date.now() });
      }),
    [],
  );

  // Переход на другую страницу закрывает панель
  // biome-ignore lint/correctness/useExhaustiveDependencies: реагируем только на смену адреса
  useEffect(() => {
    setShown(null);
  }, [pathname]);

  useLayoutEffect(() => {
    if (!shown) return;
    const update = () => {
      if (anchorRef.current) setPlacement(placeUnder(anchorRef.current));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [shown, anchorRef]);

  // Таймер автозакрытия — это сама полоска внизу панели: ставим её на
  // паузу вместе с таймером, и покупатель видит, что панель «ждёт».
  useEffect(() => {
    const bar = barRef.current;
    if (!shown || !bar) return;
    const timer = bar.animate(
      [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }],
      { duration: AUTO_CLOSE_MS, fill: "forwards" },
    );
    timer.onfinish = () => close();
    timerRef.current = timer;
    return () => {
      timer.onfinish = null;
      timer.cancel();
      timerRef.current = null;
    };
  }, [shown, close]);

  // Escape и нажатие мимо панели закрывают её. Слушаем click, а не
  // pointerdown: на телефоне прокрутка страницы не даёт click, и панель
  // не исчезает от первого же касания
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const hadFocus = panelRef.current?.contains(document.activeElement);
      close();
      if (hadFocus) anchorRef.current?.focus();
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick, true);
    };
  }, [shown, close, anchorRef]);

  const pause = () => timerRef.current?.pause();
  const resume = () => {
    if (panelRef.current?.contains(document.activeElement)) return;
    timerRef.current?.play();
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y < -36 || info.velocity.y < -350) close("swipe");
    else resume();
  };

  const quantity = shown
    ? (items.find((i) => cartLineKey(i) === shown.lineKey)?.quantity ?? 1)
    : 0;

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {shown
          ? `Добавлено в корзину: ${shown.name}. В корзине ${count} ${pluralItems(count)}`
          : ""}
      </p>
      {mounted &&
        createPortal(
          // С «уменьшением движения» панель только проявляется, без сдвигов
          <MotionConfig reducedMotion="user">
            <AnimatePresence custom={swiped}>
              {shown && placement && (
                <motion.div
                  key="cart-added"
                  ref={panelRef}
                  role="dialog"
                  aria-modal="false"
                  aria-labelledby="cart-added-title"
                  custom={swiped}
                  variants={{
                    hidden: { opacity: 0, y: -14, scale: 0.97 },
                    visible: { opacity: 1, y: 0, scale: 1 },
                    exit: (wasSwiped: boolean) =>
                      wasSwiped
                        ? { opacity: 0, y: -140, transition: { duration: 0.2 } }
                        : {
                            opacity: 0,
                            y: -8,
                            scale: 0.98,
                            transition: { duration: 0.16, ease: "easeIn" },
                          },
                  }}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{
                    type: "spring",
                    stiffness: 460,
                    damping: 34,
                    mass: 0.9,
                  }}
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0.7, bottom: 0.05 }}
                  onDragStart={pause}
                  onDragEnd={onDragEnd}
                  onPointerEnter={pause}
                  onPointerLeave={resume}
                  onFocus={pause}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      timerRef.current?.play();
                    }
                  }}
                  style={{
                    position: "fixed",
                    top: placement.top,
                    left: placement.left,
                    width: placement.width,
                    transformOrigin: `${placement.caretX}px 0px`,
                  }}
                  className="z-[45] rounded-2xl border border-espresso/10 bg-parchment shadow-[0_24px_60px_-16px_rgba(22,21,19,0.38)]"
                >
                  {/* «Хвостик», указывающий на значок корзины */}
                  <span
                    aria-hidden="true"
                    className="absolute -top-[6.5px] size-3 rotate-45 rounded-tl-[3px] border-l border-t border-espresso/10 bg-parchment"
                    style={{ left: placement.caretX - 6 }}
                  />
                  <div className="relative overflow-hidden rounded-2xl">
                    <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3">
                      <p
                        id="cart-added-title"
                        className="flex items-center gap-2 text-[13px] font-medium text-espresso"
                      >
                        <span className="flex size-5 items-center justify-center rounded-full bg-espresso text-parchment">
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                            aria-hidden="true"
                          >
                            <motion.path
                              d="M2 6.5l2.5 2.5 5.5-5.5"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              initial={reduceMotion ? false : { pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{
                                duration: 0.35,
                                delay: 0.12,
                                ease: "easeOut",
                              }}
                            />
                          </svg>
                        </span>
                        Добавлено в корзину
                      </p>
                      <button
                        type="button"
                        aria-label="Закрыть"
                        onClick={() => close()}
                        className="-mr-2 flex size-8 items-center justify-center rounded-full text-taupe transition-colors hover:bg-espresso/6 hover:text-espresso focus-visible:ring-2 focus-visible:ring-espresso/30 outline-none"
                      >
                        <XIcon className="size-4" strokeWidth={1.5} />
                      </button>
                    </div>

                    <motion.div
                      key={shown.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="flex gap-3 px-4"
                    >
                      <div className="relative h-[72px] w-14 shrink-0 overflow-hidden rounded-lg bg-sand">
                        {shown.image ? (
                          <Image
                            src={shown.image}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-taupe/50">
                            <ImageOffIcon
                              className="size-5"
                              aria-hidden="true"
                            />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 py-0.5">
                        <p className="line-clamp-2 font-serif text-[15px] leading-snug text-espresso">
                          {shown.name}
                        </p>
                        <p className="mt-1 text-[13px] text-espresso tabular-nums">
                          {formatPrice(shown.price / 100)}
                          {quantity > 1 && (
                            <span className="text-taupe">
                              {" "}
                              · в корзине {quantity} шт.
                            </span>
                          )}
                        </p>
                      </div>
                    </motion.div>

                    <div className="mx-4 mt-3 flex items-baseline justify-between gap-3 border-t border-espresso/8 pt-3 text-[13px]">
                      <span className="text-taupe">
                        В корзине {count} {pluralItems(count)}
                      </span>
                      <span className="font-medium text-espresso tabular-nums">
                        {formatPrice(subtotal / 100)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-4 pt-3">
                      <button
                        type="button"
                        onClick={() => close()}
                        className="min-h-11 rounded-full border border-espresso/15 px-3 text-[13px] leading-tight text-espresso transition-colors hover:border-espresso focus-visible:ring-2 focus-visible:ring-espresso/30 outline-none"
                      >
                        Продолжить
                        <span className="hidden min-[400px]:inline">
                          {" "}
                          покупки
                        </span>
                      </button>
                      <Link
                        href="/cart"
                        onClick={() => {
                          reachGoal("cart_panel_go_to_cart");
                          close();
                        }}
                        className="group flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-espresso px-3 text-[13px] leading-tight text-parchment transition-colors hover:bg-dark-grey focus-visible:ring-2 focus-visible:ring-espresso/30 focus-visible:ring-offset-2 outline-none"
                      >
                        Перейти в корзину
                        <ArrowRightIcon
                          className="hidden size-3.5 transition-transform group-hover:translate-x-0.5 min-[400px]:block"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      </Link>
                    </div>

                    <span
                      ref={barRef}
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-espresso/20"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </MotionConfig>,
          document.body,
        )}
    </>
  );
}
