"use client";

import { CheckIcon } from "lucide-react";
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
import { isPurchasable } from "@/lib/in-stock";
import type { Product } from "@/lib/ozon-types";
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
  // Пока кнопка показывает «Добавлено», не подменяем её ссылкой.
  if (inCart >= limit && !added) {
    return (
      <Button asChild className={buttonClassName}>
        <Link href="/cart">
          {limit === 1 ? "В корзине — перейти" : "Весь остаток в корзине"}
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
        ) : (
          label
        )}
      </span>
    </Button>
  );
}
