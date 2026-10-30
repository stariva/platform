"use client";

import { ArrowRightIcon, CheckIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { reachGoal, trackProductEvent } from "@/lib/analytics";
import {
  cartLineKey,
  MAX_CART_QUANTITY,
  useCart,
} from "@/lib/cart/cart-context";
import { flyToCart } from "@/lib/cart/fly-to-cart";
import type { Product } from "@/lib/catalog/types";
import { isPurchasable } from "@/lib/in-stock";
import { cn } from "@/lib/utils";

/** Сколько кнопка показывает «Добавлено», прежде чем вернуться в обычный вид. */
const ADDED_MS = 1800;

/**
 * Добавляет изделие в корзину: фото улетает к значку корзины в шапке, там
 * выезжает панель «Добавлено в корзину». Отправляет аналитику.
 * Возвращает null, если у товара нет свободного остатка или SKU Ozon.
 */
export function AddToCartButton({
  product,
  className,
  label = "В корзину",
}: {
  product: Product;
  className?: string;
  label?: string;
}) {
  const { add, items } = useCart();
  const [added, setAdded] = useState(false);
  // Подпись анимируем только после нажатия, а не при первом показе каталога
  const [pressed, setPressed] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!isPurchasable(product)) return null;

  const inCart =
    items.find(
      (item) =>
        item.fulfillmentType === "stock" && item.productSlug === product.slug,
    )?.quantity ?? 0;
  const limit = Math.min(product.stockAvailable, MAX_CART_QUANTITY);
  const buttonClassName = cn(
    className ??
      "flex items-center justify-center gap-2 w-full bg-espresso hover:bg-terracotta text-white py-4 h-auto rounded-2xl transition-colors label-caps",
    "transition-[color,background-color,transform] active:scale-[0.98] motion-reduce:active:scale-100",
  );

  // Весь остаток уже в корзине — класть больше нечего, ведём к оформлению.
  // Пока кнопка показывает «Добавлено», не подменяем её ссылкой. Вид другой —
  // спокойный, а не заливка покупки: это состояние, а не призыв к действию.
  if (inCart >= limit && !added) {
    return (
      <Button
        asChild
        className={cn(
          buttonClassName,
          "bg-sage/10 text-sage border border-sage/30 hover:bg-sage/20 hover:text-sage",
        )}
      >
        <Link
          href="/cart"
          aria-label={
            limit === 1
              ? "Уже в корзине, перейти к оформлению"
              : "Весь остаток уже в корзине, перейти к оформлению"
          }
        >
          <CheckIcon className="size-4" strokeWidth={2} aria-hidden="true" />
          {limit === 1 ? "В корзине" : "Весь остаток в корзине"}
          <ArrowRightIcon
            className="size-4"
            strokeWidth={2}
            aria-hidden="true"
          />
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      onClick={(event) => {
        if (inCart >= limit) return;
        const item = {
          productSlug: product.slug,
          fulfillmentType: "stock" as const,
          ozonSku: product.ozonSku as number,
          name: product.name,
          image: product.images[0] ?? "",
          price: Math.round(product.price * 100),
        };
        // Полёт стартует раньше add: значок корзины придержит счётчик до приземления
        flyToCart({
          trigger: event.currentTarget,
          item: {
            lineKey: cartLineKey(item),
            name: item.name,
            image: item.image,
            price: item.price,
          },
        });
        add(item);
        trackProductEvent("add", [
          {
            id: product.slug,
            name: product.name,
            price: product.price,
            quantity: 1,
            category: product.category,
          },
        ]);
        reachGoal("add_to_cart", { product_id: product.slug });
        setAdded(true);
        setPressed(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setAdded(false), ADDED_MS);
      }}
      className={buttonClassName}
    >
      <span
        key={added ? "added" : "idle"}
        className={cn(
          "inline-flex items-center gap-2",
          pressed &&
            "animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none",
        )}
      >
        {added ? (
          <>
            <CheckIcon className="size-4" strokeWidth={2} aria-hidden="true" />
            Добавлено
          </>
        ) : inCart > 0 ? (
          // Часть остатка уже в корзине: можно добавить ещё, но видно, сколько лежит
          <>
            Добавить ещё
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] tabular-nums"
              title={`В корзине: ${inCart}`}
              role="img"
              aria-label={`Уже в корзине: ${inCart}`}
            >
              <CheckIcon
                className="size-3"
                strokeWidth={2.5}
                aria-hidden="true"
              />
              {inCart}
            </span>
          </>
        ) : (
          label
        )}
      </span>
    </Button>
  );
}
