"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart/cart-context";

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

export function CartTrigger({ isSolid }: { isSolid: boolean }) {
  const { count } = useCart();

  return (
    <Link
      href="/cart"
      aria-label="Корзина"
      className={`relative hidden lg:inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
        isSolid
          ? "bg-espresso/8 text-espresso hover:bg-espresso/14"
          : "bg-white/15 border border-white/40 text-white hover:bg-white hover:text-espresso"
      }`}
    >
      <CartIcon />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-terracotta text-white text-[10px] font-medium">
          {count}
        </span>
      )}
    </Link>
  );
}
