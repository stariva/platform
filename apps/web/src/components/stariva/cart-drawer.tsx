"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCart } from "@/lib/cart/cart-context";
import { formatPrice } from "@/lib/products";

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
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
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
        </button>
      </SheetTrigger>
      <CartDrawerContent />
    </Sheet>
  );
}

function CartDrawerContent() {
  const { items, remove, setQty, subtotal } = useCart();

  return (
    <SheetContent className="flex flex-col">
      <SheetHeader>
        <SheetTitle className="font-serif">Корзина</SheetTitle>
      </SheetHeader>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-taupe text-sm">Корзина пуста</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 space-y-4">
          {items.map((item) => (
            <div key={item.productSlug} className="flex gap-3">
              <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-sand flex-shrink-0">
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-espresso text-sm font-medium truncate">
                  {item.name}
                </p>
                <p className="text-taupe text-xs mt-0.5">
                  {formatPrice(item.price / 100)}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setQty(item.productSlug, item.quantity - 1)}
                    className="w-6 h-6 rounded-full border border-espresso/15 text-espresso text-xs flex items-center justify-center"
                    aria-label="Уменьшить количество"
                  >
                    −
                  </button>
                  <span className="text-xs text-espresso w-4 text-center">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(item.productSlug, item.quantity + 1)}
                    className="w-6 h-6 rounded-full border border-espresso/15 text-espresso text-xs flex items-center justify-center"
                    aria-label="Увеличить количество"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item.productSlug)}
                    className="ml-auto text-taupe text-xs hover:text-terracotta transition-colors"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <SheetFooter className="border-t border-espresso/8 pt-4">
          <div className="flex items-center justify-between w-full mb-3">
            <span className="text-taupe text-sm">Товары</span>
            <span className="text-espresso font-medium">
              {formatPrice(subtotal / 100)}
            </span>
          </div>
          <Button
            asChild
            className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark"
          >
            <Link href="/checkout">Оформить заказ</Link>
          </Button>
        </SheetFooter>
      )}
    </SheetContent>
  );
}
