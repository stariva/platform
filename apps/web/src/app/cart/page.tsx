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
import {
  type CartItem,
  cartLineKey,
  type FulfillmentType,
  useCart,
} from "@/lib/cart/cart-context";
import {
  type CartLineState,
  useCartValidation,
} from "@/lib/cart/use-cart-validation";
import { IN_STOCK_HREF, IN_STOCK_SHIP_DAYS, pluralItems } from "@/lib/in-stock";
import { CartItemRow } from "./cart-item-row";
import { CartSummary, MobileCheckoutBar } from "./cart-summary";

const SECTION_ORDER: FulfillmentType[] = ["stock", "made_to_order"];

const SECTION_TITLES: Record<FulfillmentType, { title: string; hint: string }> =
  {
    stock: {
      title: "Готовые изделия",
      hint: "Отправим со склада, оплачиваются отдельно",
    },
    made_to_order: {
      title: "Под заказ",
      hint: "Сначала заявка мастеру, оплата — после согласования",
    },
  };

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

  const stateOf = (item: CartItem): CartLineState =>
    states.get(cartLineKey(item)) ?? { status: "unknown" };
  // Готовые изделия и изделия под заказ оформляются и оплачиваются раздельно
  const sections = SECTION_ORDER.map((kind) => {
    const sectionItems = items.filter((item) => item.fulfillmentType === kind);
    const buyable = sectionItems.filter(
      (item) => stateOf(item).status !== "unavailable",
    );
    return {
      kind,
      items: sectionItems,
      unavailable: sectionItems.filter(
        (item) => stateOf(item).status === "unavailable",
      ),
      subtotal: buyable.reduce((sum, i) => sum + i.price * i.quantity, 0),
      count: buyable.reduce((sum, i) => sum + i.quantity, 0),
    };
  }).filter((section) => section.items.length > 0);
  // Мобильная панель — только когда оформление одно: при двух секциях
  // итог каждой стоит сразу под её списком
  const single = sections.length === 1 ? sections[0] : undefined;
  const ctaInView = useInView(ctaRef, hydrated && Boolean(single));

  function removeItem(item: CartItem) {
    remove(cartLineKey(item));
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

  function removeUnavailable(unavailable: CartItem[]) {
    for (const item of unavailable) remove(cartLineKey(item));
  }

  const hasItems = hydrated && items.length > 0;

  return (
    <>
      <Header variant="solid" />
      <main className="pt-24 lg:pt-32 pb-28 lg:pb-24 px-5">
        <div className="max-w-6xl mx-auto">
          {/* Шаги оплаты — только у готовых изделий; под заказ сначала заявка */}
          {hasItems && sections.some((section) => section.kind === "stock") && (
            <CheckoutProgress current={0} />
          )}

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
                    <AlertDialogAction onClick={() => clear()}>
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
            <div className="space-y-12 lg:space-y-16">
              {notices.length > 0 && (
                <div
                  role="alert"
                  className="flex gap-3 rounded-2xl border border-espresso/15 px-4 py-3 text-sm text-espresso"
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
              {sections.map((section, index) => (
                <section
                  key={section.kind}
                  aria-labelledby={
                    single ? undefined : `cart-section-${section.kind}`
                  }
                >
                  {!single && (
                    <div className="mb-5">
                      <h2
                        id={`cart-section-${section.kind}`}
                        className="font-serif text-2xl lg:text-3xl text-espresso"
                      >
                        {SECTION_TITLES[section.kind].title}
                      </h2>
                      <p className="mt-1 text-sm text-taupe">
                        {SECTION_TITLES[section.kind].hint}
                      </p>
                    </div>
                  )}
                  <div className="grid gap-10 lg:gap-14 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
                    <div>
                      <ul className="border-y border-espresso/10 py-6 divide-y divide-espresso/8">
                        {section.items.map((item) => (
                          <CartItemRow
                            key={cartLineKey(item)}
                            item={item}
                            state={stateOf(item)}
                            onQuantityChange={(quantity) =>
                              setQty(cartLineKey(item), quantity)
                            }
                            onRemove={() => removeItem(item)}
                          />
                        ))}
                      </ul>
                      {index === sections.length - 1 && (
                        <Link
                          href="/catalog"
                          className="mt-5 inline-flex items-center gap-2 text-sm text-espresso hover:text-taupe transition-colors"
                        >
                          <ArrowLeftIcon
                            className="size-4"
                            aria-hidden="true"
                          />
                          Продолжить покупки
                        </Link>
                      )}
                    </div>
                    <CartSummary
                      kind={section.kind}
                      subtotal={section.subtotal}
                      count={section.count}
                      unavailableCount={section.unavailable.length}
                      checking={loading}
                      onRemoveUnavailable={() =>
                        removeUnavailable(section.unavailable)
                      }
                      ctaRef={single ? ctaRef : undefined}
                    />
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
      {hydrated && single && (
        <MobileCheckoutBar
          kind={single.kind}
          subtotal={single.subtotal}
          count={single.count}
          blocked={single.unavailable.length > 0 || single.count === 0}
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
