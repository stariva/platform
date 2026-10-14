"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart/cart-context";
import {
  isFlightPending,
  onCartLanded,
  prefersReducedMotion,
} from "@/lib/cart/fly-to-cart";
import { CartAddedPanel } from "./cart-added-panel";

function CartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 2h1.5l1.2 8.4A1.5 1.5 0 0 0 6.18 11.7h7.14a1.5 1.5 0 0 0 1.48-1.3L15.5 5H4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="15.5" r="1.1" fill="currentColor" />
      <circle cx="13" cy="15.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

/** Отскок значка, «пойманного» изделием: короткая пружина с наклоном. */
function bounce(icon: HTMLElement, ring: HTMLElement, badge?: HTMLElement) {
  icon.animate(
    [
      { transform: "none" },
      { transform: "translateY(2px) scale(0.9)", offset: 0.18 },
      { transform: "translateY(-2px) scale(1.16) rotate(-8deg)", offset: 0.45 },
      { transform: "scale(0.97) rotate(3deg)", offset: 0.72 },
      { transform: "none" },
    ],
    { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  );
  ring.animate(
    [
      { transform: "scale(1)", opacity: 0.5 },
      { transform: "scale(2)", opacity: 0 },
    ],
    { duration: 700, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  );
  badge?.animate(
    [
      { transform: "scale(0.4)" },
      { transform: "scale(1.3)", offset: 0.5 },
      { transform: "scale(1)" },
    ],
    { duration: 420, delay: 80, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
  );
}

export function CartTrigger({ isSolid }: { isSolid: boolean }) {
  const { count } = useCart();
  // Пока изделие летит, счётчик показывает прежнее число и меняется,
  // когда оно «долетело», — так видно, куда оно попало.
  const [shownCount, setShownCount] = useState(count);
  const [landings, setLandings] = useState(0);
  const countRef = useRef(count);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    countRef.current = count;
    setShownCount((prev) =>
      isFlightPending() && count > prev ? prev : count,
    );
  }, [count]);

  useEffect(
    () =>
      onCartLanded(() => {
        setShownCount(countRef.current);
        setLandings((n) => n + 1);
      }),
    [],
  );

  useEffect(() => {
    if (landings === 0 || prefersReducedMotion()) return;
    if (iconRef.current && ringRef.current) {
      bounce(iconRef.current, ringRef.current, badgeRef.current ?? undefined);
    }
    // Без касания пользователя Chrome запрещает вибрацию и ругается в консоль
    if ("vibrate" in navigator && navigator.userActivation?.hasBeenActive) {
      navigator.vibrate(12);
    }
  }, [landings]);

  return (
    <>
      <Link
        ref={linkRef}
        href="/cart"
        aria-label={`Корзина: ${count}`}
        data-cart-target
        className={`relative inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
          isSolid
            ? "bg-espresso/8 text-espresso hover:bg-espresso/14"
            : "bg-white/15 border border-white/40 text-white hover:bg-white hover:text-espresso"
        }`}
      >
        <span
          ref={ringRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full border border-current opacity-0"
        />
        <span ref={iconRef} className="inline-flex">
          <CartIcon />
        </span>
        {shownCount > 0 && (
          <span
            ref={badgeRef}
            className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-terracotta text-white text-[10px] font-medium tabular-nums overflow-hidden"
          >
            <span
              key={shownCount}
              className={
                landings > 0
                  ? "animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
                  : undefined
              }
            >
              {shownCount > 99 ? "99+" : shownCount}
            </span>
          </span>
        )}
      </Link>
      <CartAddedPanel anchorRef={linkRef} />
    </>
  );
}
