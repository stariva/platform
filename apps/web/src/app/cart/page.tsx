"use client";

import {
  ArrowLeftIcon,
  ShoppingBagIcon,
  TriangleAlertIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckoutProgress } from "@/components/stariva/checkout-progress";
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
import { CartSummary, MobileCheckoutBar } from "./cart-summary";

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
  const ctaRef = useRef<HTMLDivElement>(null);
  const ctaInView = useInView(ctaRef, hydrated && items.length > 0);

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

  const hasItems = hydrated && items.length > 0;

  return (
    <>
      <Header variant="solid" />
      <main className="pt-24 lg:pt-32 pb-28 lg:pb-24 px-5">
        <div className="max-w-6xl mx-auto">
          {hasItems && <CheckoutProgress current={0} />}

          <div className="flex items-end justify-between gap-4 mb-6 lg:mb-8">
            <h1 className="font-serif text-4xl lg:text-5xl text-espresso">
              Корзина
              {hasItems && (
                <span className="ml-3 align-middle font-sans text-sm text-taupe">
                  {totalCount} {pluralItems(totalCount)}
                </span>
              )}
            </h1>
            {hydrated && items.length > 1 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    className="mb-1 text-[13px] text-taupe underline-offset-4 hover:underline hover:text-espresso transition-colors"
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
            <div className="grid gap-10 lg:gap-14 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
              <div>
                {notices.length > 0 && (
                  <div
                    role="alert"
                    className="mb-6 flex gap-3 rounded-2xl border border-espresso/15 px-4 py-3 text-sm text-espresso"
                  >
                    <TriangleAlertIcon
                      className="size-4 shrink-0 mt-0.5"
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
                      className="shrink-0 self-start text-taupe underline underline-offset-4 hover:text-espresso transition-colors"
                    >
                      Понятно
                    </button>
                  </div>
                )}
                <ul className="border-y border-espresso/10 py-6 divide-y divide-espresso/8">
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
                <Link
                  href="/catalog"
                  className="mt-5 inline-flex items-center gap-2 text-sm text-espresso hover:text-taupe transition-colors"
                >
                  <ArrowLeftIcon className="size-4" aria-hidden="true" />
                  Продолжить покупки
                </Link>
              </div>
              <CartSummary
                subtotal={subtotal}
                count={count}
                unavailableCount={unavailable.length}
                checking={loading}
                onRemoveUnavailable={removeUnavailable}
                ctaRef={ctaRef}
              />
            </div>
          )}
        </div>
      </main>
      {hasItems && (
        <MobileCheckoutBar
          subtotal={subtotal}
          count={count}
          blocked={unavailable.length > 0 || count === 0}
          visible={!ctaInView}
        />
      )}
      <Footer />
    </>
  );
}

/** Виден ли элемент на экране; пока не знаем — считаем, что виден. */
function useInView(
  ref: React.RefObject<HTMLElement | null>,
  enabled: boolean,
): boolean {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node) return;
    const observer = new IntersectionObserver(([entry]) => {
      // Кнопка уже проскролена вверх — панель внизу больше не нужна
      setInView(
        Boolean(entry?.isIntersecting) ||
          (entry?.boundingClientRect.top ?? 0) < 0,
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, enabled]);
  return inView;
}

function CartSkeleton() {
  return (
    <div
      className="grid gap-10 lg:gap-14 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start"
      aria-busy="true"
    >
      <div className="border-y border-espresso/10 py-6 space-y-8">
        {[0, 1].map((key) => (
          <div key={key} className="flex gap-5">
            <Skeleton className="w-24 h-30 rounded-xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-9 w-28 rounded-full" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="border-y border-espresso/10 py-16 lg:py-24 px-6 text-center">
      <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-sand text-espresso">
        <ShoppingBagIcon
          className="size-6"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </div>
      <h2 className="font-serif text-3xl text-espresso mb-3">
        В корзине пока пусто
      </h2>
      <p className="text-taupe text-sm max-w-md mx-auto mb-8 leading-relaxed">
        Готовые изделия можно купить сразу — отправим за {IN_STOCK_SHIP_DAYS}. А
        если нужен свой размер или цвет, сплетём под заказ.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          asChild
          className="h-12 px-7 rounded-full bg-espresso text-parchment hover:bg-espresso/85"
        >
          <Link href={IN_STOCK_HREF}>Готовые изделия</Link>
        </Button>
        <Button asChild variant="outline" className="h-12 px-7 rounded-full">
          <Link href="/catalog">Весь каталог</Link>
        </Button>
      </div>
      <Link
        href="/#order"
        className="mt-6 inline-block text-sm text-taupe underline underline-offset-4 hover:text-espresso transition-colors"
      >
        Заказать изделие под себя
      </Link>
    </div>
  );
}
