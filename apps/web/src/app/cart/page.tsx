"use client";

import { ShoppingBagIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trackProductEvent } from "@/lib/analytics";
import { type CartItem, useCart } from "@/lib/cart/cart-context";
import { useCartValidation } from "@/lib/cart/use-cart-validation";
import { IN_STOCK_HREF, IN_STOCK_SHIP_DAYS, pluralItems } from "@/lib/in-stock";
import { CartItemRow } from "./cart-item-row";
import { CartSummary } from "./cart-summary";

export default function CartPage() {
  const {
    items,
    hydrated,
    count: totalCount,
    add,
    remove,
    setQty,
    clear,
  } = useCart();
  const { states, loading, notices, dismissNotices } = useCartValidation();

  const isUnavailable = (item: CartItem) =>
    states.get(item.productSlug)?.status === "unavailable";
  const buyable = items.filter((item) => !isUnavailable(item));
  const unavailable = items.filter(isUnavailable);
  const subtotal = buyable.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = buyable.reduce((sum, i) => sum + i.quantity, 0);

  function removeItem(item: CartItem) {
    remove(item.productSlug);
    trackProductEvent("remove", [
      {
        id: item.productSlug,
        name: item.name,
        price: item.price / 100,
        quantity: item.quantity,
      },
    ]);
    const { quantity, ...product } = item;
    toast("Изделие удалено из корзины", {
      description: item.name,
      action: { label: "Вернуть", onClick: () => add(product, quantity) },
    });
  }

  function removeUnavailable() {
    for (const item of unavailable) remove(item.productSlug);
  }

  return (
    <>
      <Header variant="solid" />
      <main className="pt-28 lg:pt-36 pb-24 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-end justify-between gap-4 mb-8">
            <h1 className="font-serif text-3xl lg:text-4xl text-espresso">
              Корзина
              {hydrated && totalCount > 0 && (
                <span className="ml-3 align-middle font-sans text-base text-taupe">
                  {totalCount} {pluralItems(totalCount)}
                </span>
              )}
            </h1>
            {hydrated && items.length > 1 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    className="text-sm text-taupe underline underline-offset-4 hover:text-terracotta transition-colors"
                  >
                    Очистить корзину
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Очистить корзину?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Все изделия будут удалены из корзины.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction onClick={clear}>
                      Очистить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {!hydrated ? (
            <CartSkeleton />
          ) : items.length === 0 ? (
            <EmptyCart />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
              <div className="space-y-4">
                {notices.length > 0 && (
                  <div
                    role="alert"
                    className="flex gap-3 rounded-2xl border border-terracotta/30 bg-sand px-4 py-3 text-sm text-espresso"
                  >
                    <TriangleAlertIcon
                      className="size-4 shrink-0 mt-0.5 text-terracotta"
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      {notices.map((notice) => (
                        <p key={notice}>{notice}</p>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={dismissNotices}
                      className="shrink-0 self-start text-taupe underline underline-offset-4 hover:text-terracotta transition-colors"
                    >
                      Понятно
                    </button>
                  </div>
                )}
                <ul className="bg-white border border-espresso/10 rounded-2xl divide-y divide-espresso/8">
                  {items.map((item) => (
                    <CartItemRow
                      key={item.productSlug}
                      item={item}
                      state={
                        states.get(item.productSlug) ?? { status: "unknown" }
                      }
                      onQuantityChange={(quantity) =>
                        setQty(item.productSlug, quantity)
                      }
                      onRemove={() => removeItem(item)}
                    />
                  ))}
                </ul>
              </div>
              <CartSummary
                subtotal={subtotal}
                count={count}
                unavailableCount={unavailable.length}
                checking={loading}
                onRemoveUnavailable={removeUnavailable}
              />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function CartSkeleton() {
  return (
    <div
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start"
      aria-busy="true"
    >
      <div className="bg-white border border-espresso/10 rounded-2xl divide-y divide-espresso/8">
        {[0, 1].map((key) => (
          <div key={key} className="flex gap-4 p-5">
            <Skeleton className="size-24 rounded-xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-9 w-28 rounded-full" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="bg-white border border-espresso/10 rounded-2xl py-16 px-6 text-center">
      <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-sand text-espresso">
        <ShoppingBagIcon className="size-6" aria-hidden="true" />
      </div>
      <h2 className="font-serif text-2xl text-espresso mb-2">
        В корзине пока пусто
      </h2>
      <p className="text-taupe text-sm max-w-md mx-auto mb-8 leading-relaxed">
        Готовые изделия можно купить сразу — отправим за {IN_STOCK_SHIP_DAYS}. А
        если нужен свой размер или цвет, сплетём под заказ.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          asChild
          className="bg-terracotta text-parchment hover:bg-terracotta-dark"
        >
          <Link href={IN_STOCK_HREF}>Готовые изделия</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/catalog">Весь каталог</Link>
        </Button>
      </div>
      <Link
        href="/#order"
        className="mt-6 inline-block text-sm text-taupe underline underline-offset-4 hover:text-terracotta transition-colors"
      >
        Заказать изделие под себя
      </Link>
    </div>
  );
}
