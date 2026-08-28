"use client";

import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/cart-context";
import { formatPrice } from "@/lib/products";

export default function CartPage() {
  const { items, remove, setQty, subtotal } = useCart();

  return (
    <>
      <Header variant="solid" />
      <main className="pt-28 lg:pt-36 pb-24 px-5">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-serif text-3xl lg:text-4xl text-espresso mb-8">
            Корзина
          </h1>

          {items.length === 0 ? (
            <div className="bg-white border border-espresso/10 rounded-2xl py-20 px-6 text-center">
              <p className="text-taupe text-sm mb-6">Корзина пуста</p>
              <Button asChild className="bg-terracotta text-parchment hover:bg-terracotta-dark">
                <Link href="/catalog">В каталог</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="bg-white border border-espresso/10 rounded-2xl p-5 mb-6 divide-y divide-espresso/8">
                {items.map((item) => (
                  <div key={item.productSlug} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-sand flex-shrink-0">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-espresso text-sm font-medium truncate">
                        {item.name}
                      </p>
                      <p className="text-taupe text-xs mt-0.5">
                        {formatPrice(item.price / 100)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setQty(item.productSlug, item.quantity - 1)}
                          className="w-7 h-7 rounded-full border border-espresso/15 text-espresso text-sm flex items-center justify-center"
                          aria-label="Уменьшить количество"
                        >
                          −
                        </button>
                        <span className="text-sm text-espresso w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQty(item.productSlug, item.quantity + 1)}
                          className="w-7 h-7 rounded-full border border-espresso/15 text-espresso text-sm flex items-center justify-center"
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
                    <span className="text-espresso text-sm font-medium flex-shrink-0">
                      {formatPrice((item.price * item.quantity) / 100)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-espresso/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-taupe text-sm">Товары</span>
                  <span className="text-espresso font-medium">
                    {formatPrice(subtotal / 100)}
                  </span>
                </div>
                <Button
                  asChild
                  className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark py-6"
                >
                  <Link href="/checkout">Оформить заказ</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
